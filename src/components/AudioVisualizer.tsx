import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Sliders, Activity } from 'lucide-react';

interface AudioVisualizerProps {
  isPlaying: boolean;
  artworkUrl?: string | null;
  audioElement?: HTMLAudioElement | null;
}

export default function AudioVisualizer({ isPlaying, artworkUrl, audioElement }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visualizerType, setVisualizerType] = useState<'bars' | 'waves'>('bars');
  const [sensitivity, setSensitivity] = useState<number>(1.0);
  
  // Real audio analyzer nodes
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [isUsingRealAudio, setIsUsingRealAudio] = useState(false);

  useEffect(() => {
    if (!audioElement) return;

    const initAudioAnalyzer = () => {
      try {
        if (!audioContextRef.current) {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          audioContextRef.current = new AudioContextClass();
        }

        if (!analyserRef.current && audioContextRef.current) {
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
          analyserRef.current.smoothingTimeConstant = 0.8;
        }

        if (!sourceNodeRef.current && audioContextRef.current && analyserRef.current) {
          // Note: If audioElement has CORS issues, this will throw or taint the canvas block
          sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioElement);
          sourceNodeRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
          setIsUsingRealAudio(true);
        }

        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }
      } catch (err) {
        console.warn('[AudioAnalyzer] Could not initialize real audio analyzer:', err);
        setIsUsingRealAudio(false);
      }
    };

    // Initialize when audio starts playing
    const handlePlaying = () => initAudioAnalyzer();
    audioElement.addEventListener('playing', handlePlaying);
    
    // Attempt init right away
    if (!audioElement.paused) {
      initAudioAnalyzer();
    }

    return () => {
      audioElement.removeEventListener('playing', handlePlaying);
    };
  }, [audioElement]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeObserver = new ResizeObserver(() => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight || 150;
      }
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight || 150;
    }

    const barsCount = 48;
    const barWidth = 4;
    const gap = 3;

    // Fake amplitudes
    const fakeAmplitudes = new Array(barsCount).fill(1).map(() => Math.random() * 40 + 5);
    const fakePhases = new Array(barsCount).fill(0).map(() => Math.random() * Math.PI * 2);

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const width = canvas.width;
      const height = canvas.height;

      let freqData: Uint8Array | null = null;
      let timeData: Uint8Array | null = null;
      
      if (isUsingRealAudio && analyserRef.current && isPlaying) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        freqData = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(freqData);

        timeData = new Uint8Array(bufferLength);
        analyserRef.current.getByteTimeDomainData(timeData);
      }

      if (visualizerType === 'bars') {
        const drawBarsCount = freqData ? Math.min(barsCount, freqData.length) : barsCount;
        const startX = (width - (drawBarsCount * (barWidth + gap) - gap)) / 2;

        for (let i = 0; i < drawBarsCount; i++) {
          let barHeight = 4;
          
          if (freqData) {
            // Real audio mapping
            const value = freqData[i];
            const percent = value / 255;
            barHeight = Math.max(4, percent * height * sensitivity);
          } else {
            // Fake audio fallback
            const currentPhase = fakePhases[i] + (isPlaying ? Date.now() * 0.006 : 0);
            const dynamicFactor = isPlaying ? Math.sin(currentPhase) * 0.5 + 0.5 : 0.05;
            barHeight = Math.max(4, fakeAmplitudes[i] * dynamicFactor * sensitivity + 4);
          }

          const x = startX + i * (barWidth + gap);
          const y = height - barHeight;

          const gradient = ctx.createLinearGradient(0, height, 0, y);
          gradient.addColorStop(0, 'rgba(236, 72, 153, 0.25)'); // deep pink
          gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.7)'); // purple
          gradient.addColorStop(1, 'rgba(59, 130, 246, 1)'); // neon blue

          ctx.fillStyle = gradient;
          
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x, y, barWidth, barHeight, 2);
          } else {
            ctx.rect(x, y, barWidth, barHeight);
          }
          ctx.fill();
        }
      } else {
        // Draw waves
        if (timeData) {
          // Real waveform
          ctx.beginPath();
          const sliceWidth = width * 1.0 / timeData.length;
          let x = 0;

          for (let i = 0; i < timeData.length; i++) {
            const v = timeData[i] / 128.0; // 0 to 2
            const adjustedV = 1 + (v - 1) * sensitivity; // scale variation
            const y = (adjustedV * height) / 2;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }

            x += sliceWidth;
          }

          const gradient = ctx.createLinearGradient(0, 0, width, 0);
          gradient.addColorStop(0, 'rgba(236, 72, 153, 0.85)'); // neon pink
          gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.85)'); // purple
          gradient.addColorStop(1, 'rgba(59, 130, 246, 0.85)'); // neon blue
          
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 2.5;
          ctx.stroke();

        } else {
          // Fake waveform
          const wavesCount = 3;
          for (let w = 0; w < wavesCount; w++) {
            ctx.beginPath();
            const speed = 0.0025 * (w + 1);
            const phase = isPlaying ? Date.now() * speed : 0;
            const waveHeight = height / 2;
            
            for (let x = 0; x <= width; x += 4) {
              const angle = (x / width) * Math.PI * 3 + phase;
              const envelope = Math.sin((x / width) * Math.PI);
              const amplitude = (25 + w * 12) * sensitivity * (isPlaying ? 1.0 : 0.08) * envelope;
              const y = waveHeight + Math.sin(angle) * amplitude;
              
              if (x === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            }
            
            const gradient = ctx.createLinearGradient(0, 0, width, 0);
            if (w === 0) {
              gradient.addColorStop(0, 'rgba(236, 72, 153, 0.85)'); // neon pink
              gradient.addColorStop(1, 'rgba(168, 85, 247, 0.85)'); // purple
              ctx.strokeStyle = gradient;
            } else if (w === 1) {
              gradient.addColorStop(0, 'rgba(168, 85, 247, 0.65)'); // purple
              gradient.addColorStop(1, 'rgba(59, 130, 246, 0.65)'); // neon blue
              ctx.strokeStyle = gradient;
            } else {
              gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)'); // neon blue
              gradient.addColorStop(1, 'rgba(236, 72, 153, 0.4)'); // thin pink
              ctx.strokeStyle = gradient;
            }
              
            ctx.lineWidth = 2.5 - w * 0.5;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, visualizerType, sensitivity, isUsingRealAudio]);

  return (
    <div className="space-y-3">
      <div className="relative w-full h-32 flex items-end justify-center rounded-xl overflow-hidden bg-black/10 dark:bg-black/20">
        <canvas ref={canvasRef} className="w-full h-full" />
        {isUsingRealAudio && (
          <div className="absolute top-2 right-2 text-[8px] font-mono text-emerald-400 bg-black/40 px-1.5 py-0.5 rounded font-bold uppercase flex items-center gap-1">
            <Activity className="w-2.5 h-2.5" />
            Live Web Audio
          </div>
        )}
      </div>

      {/* Control Panel */}
      <div className="flex items-center justify-between gap-3 p-2 px-3 bg-neutral-100/60 dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/5 text-xs">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-pink-500 shrink-0" />
          <div className="flex rounded-md overflow-hidden bg-neutral-200 dark:bg-neutral-800 p-0.5">
            <button
              type="button"
              onClick={() => setVisualizerType('bars')}
              className={`px-2 py-0.5 text-[9px] font-bold rounded-sm transition-all cursor-pointer ${
                visualizerType === 'bars'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-950 dark:text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400'
              }`}
            >
              Bars
            </button>
            <button
              type="button"
              onClick={() => setVisualizerType('waves')}
              className={`px-2 py-0.5 text-[9px] font-bold rounded-sm transition-all cursor-pointer ${
                visualizerType === 'waves'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-950 dark:text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400'
              }`}
            >
              Waves
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-[160px]">
          <Sliders className="w-3 h-3 text-neutral-400 shrink-0" />
          <input
            type="range"
            min="0.2"
            max="2.0"
            step="0.1"
            value={sensitivity}
            onChange={(e) => setSensitivity(parseFloat(e.target.value))}
            className="w-full h-1 bg-neutral-300 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
            title={`Sensitivity: ${sensitivity}x`}
          />
          <span className="font-mono text-[9px] text-pink-500 font-bold shrink-0">{sensitivity.toFixed(1)}x</span>
        </div>
      </div>
    </div>
  );
}
