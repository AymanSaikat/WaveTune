import React, { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Track, PlaybackState } from '../types';
import GlassCard from './GlassCard';
import AudioVisualizer from './AudioVisualizer';
import DeviceSelector from './DeviceSelector';
import {
  Tv,
  Smartphone,
  CheckCircle,
  Clock,
  Volume2,
  VolumeX,
  Play,
  Pause,
  HelpCircle,
  Video
} from 'lucide-react';

interface PlayerViewProps {
  socket: Socket | null;
  queue: Track[];
  playbackState: PlaybackState;
  onAlert: (msg: string, type: 'success' | 'error') => void;
  theme: 'light' | 'dark';
}

export default function PlayerView({ socket, queue, playbackState, onAlert, theme }: PlayerViewProps) {
  const currentTrack = queue.find(t => t.id === playbackState.currentTrackId);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isPaired, setIsPaired] = useState(false);
  const [pairedHost, setPairedHost] = useState('');
  const [localProgress, setLocalProgress] = useState(0);
  const [muted, setMuted] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [audioAutoplayBlocked, setAudioAutoplayBlocked] = useState(false);

  // Device UUID configuration
  const deviceIdRef = useRef<string>('');
  
  // HTML5 audio container backing to guarantee robust local sound playback and output route control
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Instantiate stable client audio component
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.volume = playbackState.volume / 100;
    audioRef.current = audio;

    // Retrieve and restore saved sound sinkId
    const storedDeviceId = localStorage.getItem('wavetune_output_device_id');
    if (storedDeviceId && storedDeviceId !== 'default' && 'setSinkId' in audio) {
      (audio as any).setSinkId(storedDeviceId)
        .then(() => console.log('Successfully synced output sink to stored system choice'))
        .catch((err: any) => console.warn('Stored speaker output sync failed:', err));
    }

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  // Synchronize master output properties (vol, mute)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : playbackState.volume / 100;
  }, [playbackState.volume, muted]);

  // Synchronize playing stream source & state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playbackState.status === 'playing' && currentTrack) {
      // Use premium Apple direct CDN stream first. Fallback to soundhelix so music is never silent!
      const activeSrc = currentTrack.previewUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
      
      if (audio.src !== activeSrc) {
        audio.src = activeSrc;
        audio.load();
      }

      audio.play()
        .then(() => {
          setAudioAutoplayBlocked(false);
        })
        .catch((err) => {
          console.warn('Browser policy temporarily blocked direct audio auto-play, waiting for focus:', err);
          setAudioAutoplayBlocked(true);
        });
    } else {
      audio.pause();
    }
  }, [playbackState.status, currentTrack]);

  // Determine a glowing backdrop color based on active track metadata to fulfill visual requirements
  const getGlowStyles = () => {
    if (!currentTrack) {
      return {
        background: 'radial-gradient(circle, rgba(168,85,247,0.15) 0%, rgba(236,72,153,0.05) 50%, rgba(0,0,0,0) 100%)',
      };
    }

    const title = currentTrack.title.toLowerCase();
    const artist = currentTrack.artist.toLowerCase();

    // Queen / Bohemian Red
    if (title.includes('bohemian') || artist.includes('queen')) {
      return {
        background: 'radial-gradient(circle, rgba(220,38,38,0.25) 0%, rgba(234,179,8,0.08) 50%, rgba(0,0,0,0) 100%)',
      };
    }
    // Weeknd / Neon Purp
    if (title.includes('light') || artist.includes('weeknd')) {
      return {
        background: 'radial-gradient(circle, rgba(236,72,153,0.25) 0%, rgba(139,92,246,0.1) 50%, rgba(0,0,0,0) 100%)',
      };
    }
    // Rick Astley Gold
    if (artist.includes('astley') || title.includes('never')) {
      return {
        background: 'radial-gradient(circle, rgba(217,119,6,0.25) 0%, rgba(139,92,246,0.05) 50%, rgba(0,0,0,0) 100%)',
      };
    }

    // Default neon cyber visual color scheme
    return {
      background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, rgba(168,85,247,0.15) 50%, rgba(0,0,0,0) 100%)',
    };
  };

  useEffect(() => {
    // Generate static Device ID
    let storedId = localStorage.getItem('musesync_device_uuid');
    if (!storedId) {
      storedId = 'dev-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('musesync_device_uuid', storedId);
    }
    deviceIdRef.current = storedId;

    // Generate readable random device tag
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const resolvedName = `Display-Terminal-${randomSuffix}`;
    setDeviceName(resolvedName);

    if (socket) {
      // Connect to Socket and request system Pairing Code
      socket.emit('join_session', { role: 'player', deviceId: storedId, deviceName: resolvedName });
      socket.emit('request_pairing_code', { deviceId: storedId, deviceName: resolvedName });

      // Code assigned
      socket.on('pairing_code_assigned', (code: string) => {
        setPairingCode(code);
      });

      // Paired successfully banner
      socket.on('paired_confirmed', (data: { pairedBy: string }) => {
        setIsPaired(true);
        setPairedHost(data.pairedBy);
        onAlert(`Terminal connected to active CMS control deck!`, 'success');
      });

      // Recurrent socket synchronizer
      socket.on('device_playback_command', (data: { action: string; track: Track | null; volume: number; status: string }) => {
        console.log(`Device received direct playback instruction:`, data);
        if (data.action === 'skip') {
          setLocalProgress(0);
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('pairing_code_assigned');
        socket.off('paired_confirmed');
        socket.off('device_playback_command');
      }
    };
  }, [socket]);

  // Handle local state timer & status reporter back to backend
  useEffect(() => {
    if (playbackState.status !== 'playing' || !currentTrack) return;

    // Set local sync tracker
    setLocalProgress(playbackState.progress);

    const interval = setInterval(() => {
      setLocalProgress(prev => {
        const next = prev + 1;
        
        // Report progress back via socket
        if (socket) {
          socket.emit('player_status_feedback', {
            progress: next,
            duration: currentTrack.duration,
            status: 'playing',
          });
        }

        // Check track completion limit
        if (next >= currentTrack.duration) {
          clearInterval(interval);
          if (socket) {
            socket.emit('player_track_finished', { trackId: currentTrack.id });
          }
          return 0;
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [playbackState.status, playbackState.currentTrackId, currentTrack, socket]);

  // Force align progress when server pushes a major progress update
  useEffect(() => {
    if (Math.abs(localProgress - playbackState.progress) > 3) {
      setLocalProgress(playbackState.progress);
    }
  }, [playbackState.progress]);

  // Time formatter
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Build the safest YouTube Embed URL for the media container
  const getEmbedUrl = () => {
    if (!currentTrack) return '';
    const autoplay = playbackState.status === 'playing' ? '1' : '0';
    const mute = muted ? '1' : '0';
    // Load embedded player, enable API tracking and mute overrides if selected
    return `https://www.youtube.com/embed/${currentTrack.youtubeId}?autoplay=${autoplay}&mute=${mute}&controls=1&enablejsapi=1&origin=${window.location.origin}`;
  };

  return (
    <div className="relative min-h-[70vh] flex flex-col justify-between overflow-hidden rounded-3xl p-6 md:p-8 animate-fade-in text-neutral-900 dark:text-white">
      {/* 1. Dynamic Blurred Glow Backing Background Gradient Accent (Apple Style) */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-1000 border border-neutral-200 dark:border-white/5 rounded-3xl z-0 filter blur-[80px]"
        style={getGlowStyles()}
      />

      {/* Autoplay Unlock Overlay Gesture Trigger */}
      {audioAutoplayBlocked && (
        <div className="absolute inset-0 bg-neutral-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center rounded-3xl">
          <div className="max-w-sm space-y-4">
            <div className="w-16 h-16 bg-pink-500/10 border border-pink-500/30 rounded-full flex items-center justify-center mx-auto text-pink-400 animate-bounce">
              <Volume2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold font-sans text-white">Unlock Live Audio</h3>
            <p className="text-xs text-neutral-400 font-mono leading-relaxed">
              Browser-level security policies require a direct click gesture to authorize audio playback and custom hardware speaker routing.
            </p>
            <button
              type="button"
              onClick={async () => {
                const audio = audioRef.current;
                if (audio) {
                  try {
                    await audio.play();
                    setAudioAutoplayBlocked(false);
                    onAlert('Sound playback successfully authorized & unlocked!', 'success');
                  } catch (e) {
                    console.error('Failed to manually trigger play:', e);
                  }
                }
              }}
              className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-95 text-white font-bold rounded-2xl text-xs font-sans transition-all cursor-pointer shadow-lg active:scale-95"
            >
              Start Streaming Sound
            </button>
          </div>
        </div>
      )}

      {/* Grid container */}
      <div className="relative z-10 w-full flex-1 flex flex-col justify-between space-y-8">
        
        {/* Top bar indicators */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-neutral-200 dark:border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <Tv className="w-5 h-5 text-pink-500 animate-pulse" />
            <div>
              <h2 className="text-sm font-semibold font-sans">Output Terminal Bridge</h2>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">{deviceName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isPaired ? (
              <span className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-mono">
                <CheckCircle className="w-3.5 h-3.5 animate-bounce" /> Paired with Admin
              </span>
            ) : (
              <span className="bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full text-xs font-mono">
                Offline Terminal Standby
              </span>
            )}
          </div>
        </div>

        {/* Playback Content Body */}
        {currentTrack ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center py-6">
            
            {/* Visual Column / Album Cover / Glowing backdrop */}
            <div className="flex flex-col items-center justify-center space-y-6">
              <div className="relative group aspect-square w-64 md:w-80 rounded-2xl overflow-hidden border border-white/15 shadow-[0_15px_45px_rgba(0,0,0,0.6)]">
                <img
                  src={currentTrack.artworkUrl}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600';
                  }}
                />
                
                {/* Visual playback state overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                  {playbackState.status === 'playing' ? (
                    <Pause className="w-12 h-12 text-white stroke-[1.5]" />
                  ) : (
                    <Play className="w-12 h-12 text-white stroke-[1.5]" />
                  )}
                </div>
              </div>

              {/* Dynamic sound bar wave visualization matches playing state */}
              <div className="w-full max-w-sm">
                <AudioVisualizer isPlaying={playbackState.status === 'playing'} artworkUrl={currentTrack.artworkUrl} />
              </div>
            </div>

            {/* Controls & Mini Embedded Screen Column */}
            <div className="space-y-6">
              <div className="space-y-2 text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-2 text-xs font-mono font-bold text-pink-500 tracking-widest uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping" /> Synchronized Stream
                </div>
                <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight font-sans text-neutral-900 dark:text-white leading-tight">
                  {currentTrack.title}
                </h1>
                <p className="text-lg text-neutral-700 dark:text-neutral-300 font-sans font-medium">
                  {currentTrack.artist}
                </p>
                <p className="text-xs text-neutral-500 font-mono pt-1">
                  Requested by: <span className="text-purple-600 dark:text-purple-400">{currentTrack.requestedBy}</span>
                </p>
              </div>

              {/* Live Media Playback Module (Safely configured via YouTube Iframe Embed API) */}
              <GlassCard theme={theme} className="p-4 border-neutral-200 dark:border-white/5 bg-black/5 dark:bg-black/25">
                <div className="flex items-center justify-between mb-3 text-xs font-mono text-neutral-500 dark:text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Video className="w-4 h-4 text-pink-400 animate-pulse" /> Live Sound Container (Active IFrame)
                  </span>
                  <span className="bg-neutral-200/50 dark:bg-white/5 px-2 py-0.5 rounded text-[10px] text-neutral-600 dark:text-neutral-400">YouTube Native</span>
                </div>

                <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-neutral-200 dark:border-white/5">
                  {currentTrack.youtubeId ? (
                    <iframe
                      id="musesync-yt-player"
                      src={getEmbedUrl()}
                      className="w-full h-full"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      title="Paired Stream Player content"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex items-center justify-center text-xs text-neutral-500">
                      Empty Media Stream
                    </div>
                  )}
                </div>

                <div className="mt-2 text-[10px] text-neutral-500 font-sans leading-relaxed text-center">
                  * Note: If browser policy blocks auto-playback, click the YouTube play button inside the frame above to start the movie.
                </div>

                <div className="flex justify-end gap-3 mt-3">
                  <button
                    onClick={() => setMuted(!muted)}
                    className="p-2 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-white/5 hover:border-neutral-300 dark:hover:border-white/10 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono"
                  >
                    {muted ? (
                      <>
                        <VolumeX className="w-4 h-4 text-pink-500" /> Unmute Player
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 text-pink-400" /> Mute Player
                      </>
                    )}
                  </button>
                </div>
              </GlassCard>

              {/* Direct Web Audio Output Device Routing Engine */}
              <DeviceSelector audioElementRef={audioRef} theme={theme} onAlert={onAlert} />

              {/* Slider meter tracker */}
              <div className="space-y-1">
                <div className="relative w-full bg-neutral-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-neutral-900 dark:bg-white h-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (localProgress / (currentTrack.duration || 1)) * 100
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono text-neutral-500 dark:text-neutral-400">
                  <span>{formatTime(localProgress)}</span>
                  <span>{formatTime(currentTrack.duration)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Landing Standby view of Player showing Pairing codes */
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <GlassCard theme={theme} className="p-8 max-w-md w-full space-y-6">
              <div className="w-16 h-16 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mx-auto text-pink-500 dark:text-pink-400">
                <Tv className="w-8 h-8 animate-pulse" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold font-sans text-neutral-900 dark:text-white">Active Pairing Required</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono leading-relaxed">
                  Enter the following numeric code in your Administration Control Center dashboard to pipe audio/video requests into this sound system.
                </p>
              </div>

              {pairingCode ? (
                <div className="py-4 px-6 bg-gradient-to-br from-purple-600/10 to-pink-600/10 rounded-2xl border border-neutral-200 dark:border-white/10">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-450 dark:text-neutral-500 block mb-1">
                    Pairing Passcode:
                  </span>
                  <div className="text-5xl font-mono font-black tracking-widest bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 dark:from-pink-400 dark:via-purple-300 dark:to-indigo-400 bg-clip-text text-transparent select-all">
                    {pairingCode}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1.5 text-xs font-mono text-neutral-500 py-4">
                  <Clock className="w-4 h-4 animate-spin text-pink-500" /> Connecting connection bridge...
                </div>
              )}

              <div className="text-[10px] font-mono text-neutral-500 border-t border-neutral-200 dark:border-white/5 pt-4 space-y-1.5">
                <p>Status: Ready to link devices</p>
                <p>Output Interface: HTML5 Sandbox</p>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Standard footer */}
        <div className="border-t border-neutral-200 dark:border-white/10 pt-4 flex flex-col sm:flex-row justify-between items-center text-xs font-mono text-neutral-500 gap-2">
          <span>WaveTune Player Terminal v1.0.0</span>
          <span>Audio Sync Output Node</span>
        </div>
      </div>
    </div>
  );
}
