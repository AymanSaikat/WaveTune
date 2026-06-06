import React, { useEffect, useState, useRef } from 'react';
import { Activity, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';

interface AudioDiagnosticsProps {
  audioElement: HTMLAudioElement | null;
  audioSourceParams?: { url: string; origin: string };
  onFallbackTriggered?: () => void;
}

export default function AudioDiagnostics({ audioElement, audioSourceParams, onFallbackTriggered }: AudioDiagnosticsProps) {
  const [logs, setLogs] = useState<{ id: string; time: string; msg: string; type: 'info' | 'warn' | 'error' | 'success' }[]>([]);
  const [audioContextStatus, setAudioContextStatus] = useState<string>('checking...');
  const [corsPolicyStatus, setCorsPolicyStatus] = useState<string>('checking...');
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const addLog = (msg: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [{ id: Math.random().toString(), time, msg, type }, ...prev].slice(0, 10));
    
    // Also log to regular console
    if (type === 'error') console.error(`[AudioDiag] ${msg}`);
    else if (type === 'warn') console.warn(`[AudioDiag] ${msg}`);
    else console.log(`[AudioDiag] ${msg}`);
  };

  useEffect(() => {
    // Check Audio Context Support
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        setAudioContextStatus('supported');
        addLog('AudioContext is supported by browser.', 'success');
      } else {
        setAudioContextStatus('unsupported');
        addLog('AudioContext is missing in this browser!', 'error');
      }
    } catch (e: any) {
      setAudioContextStatus('error');
      addLog(`AudioContext check threw error: ${e.message}`, 'error');
    }
  }, []);

  useEffect(() => {
    if (!audioElement) {
      addLog('No <audio> element attached to diagnostics.', 'warn');
      return;
    }

    addLog('Attached to media element. Monitoring events...', 'info');

    const onPlay = () => {
      addLog('Media element play() triggered.', 'info');
      // Start 5-second silence checker / timeout fallback
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      
      loadingTimerRef.current = setTimeout(() => {
        if (audioElement.paused || audioElement.currentTime === 0) {
          addLog('Source 5s timeout: no output or playback start.', 'error');
          if (onFallbackTriggered) onFallbackTriggered();
        } else {
          addLog('Playback looks healthy after 5s.', 'success');
        }
      }, 5000);
    };
    
    const onPlaying = () => {
      addLog('Media element is playing audio stream.', 'success');
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    };

    const onError = (e: any) => {
      addLog(`Media element error. Code: ${audioElement.error?.code}`, 'error');
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      if (onFallbackTriggered) onFallbackTriggered();
    };

    const onStalled = () => addLog('Media element stalled (buffering/connection).', 'warn');
    const onWaiting = () => addLog('Media element waiting for data.', 'warn');

    audioElement.addEventListener('play', onPlay);
    audioElement.addEventListener('playing', onPlaying);
    audioElement.addEventListener('error', onError);
    audioElement.addEventListener('stalled', onStalled);
    audioElement.addEventListener('waiting', onWaiting);

    return () => {
      audioElement.removeEventListener('play', onPlay);
      audioElement.removeEventListener('playing', onPlaying);
      audioElement.removeEventListener('error', onError);
      audioElement.removeEventListener('stalled', onStalled);
      audioElement.removeEventListener('waiting', onWaiting);
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    };
  }, [audioElement, onFallbackTriggered]);

  useEffect(() => {
    // Check CORS Policy loosely
    if (audioSourceParams?.url) {
      addLog(`Source updated: ${audioSourceParams.url.slice(0, 50)}...`, 'info');
      try {
        const srcUrl = new URL(audioSourceParams.url, window.location.href);
        if (srcUrl.origin !== window.location.origin) {
          setCorsPolicyStatus(`cross-origin: ${srcUrl.origin}`);
          if (!audioElement?.crossOrigin) {
            addLog('Cross-origin source but crossOrigin attribute not set on <audio>. Web Audio API may be blocked.', 'warn');
          } else {
            addLog('Cross-origin source with crossOrigin attribute set correctly.', 'success');
          }
        } else {
          setCorsPolicyStatus('same-origin');
          addLog('Source is same-origin.', 'success');
        }
      } catch(e) {
        setCorsPolicyStatus('invalid-url');
        addLog('Source URL could not be parsed.', 'error');
      }
    } else {
      setCorsPolicyStatus('no-source');
    }
  }, [audioSourceParams?.url, audioElement?.crossOrigin]);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden font-mono text-[10px]">
      <div className="p-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-neutral-200">Audio Diagnostics Panel</span>
        </div>
        <div className="flex items-center gap-4 text-neutral-400">
          <span title="Audio Context Status">CXT: {audioContextStatus}</span>
          <span title="Cross-Origin Resource Status">CORS: {corsPolicyStatus}</span>
        </div>
      </div>
      <div className="h-48 overflow-y-auto p-2 bg-black space-y-1">
        {logs.length === 0 && <div className="text-neutral-600 p-2 italic">Awaiting events...</div>}
        {logs.map((L) => (
          <div key={L.id} className="flex gap-3">
            <span className="text-neutral-500 shrink-0">[{L.time}]</span>
            <span className={`
              ${L.type === 'error' ? 'text-red-400' : ''}
              ${L.type === 'warn' ? 'text-yellow-400' : ''}
              ${L.type === 'success' ? 'text-emerald-400' : ''}
              ${L.type === 'info' ? 'text-blue-300' : ''}
            `}>
              {L.type === 'error' && <ShieldAlert className="inline w-3 h-3 mr-1 mb-0.5" />}
              {L.type === 'success' && <CheckCircle2 className="inline w-3 h-3 mr-1 mb-0.5" />}
              {L.type === 'warn' && <XCircle className="inline w-3 h-3 mr-1 mb-0.5" />}
              {L.msg}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
