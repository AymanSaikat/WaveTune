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
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string>('');
  
  // Dual-track Routing Mode selector to choose between YouTube video frame or device setSinkId audio player
  const [audioPlaybackMode, setAudioPlaybackMode] = useState<'routed' | 'youtube'>(() => {
    return (localStorage.getItem('wavetune_audio_playback_mode') as 'routed' | 'youtube') || 'youtube';
  });

  const [userGestureActive, setUserGestureActive] = useState(false);
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const lastTrackIdRef = useRef<string | null>(null);

  // Device UUID configuration
  const deviceIdRef = useRef<string>('');
  
  // HTML5 audio container backing to guarantee robust local sound playback and output route control
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Track the playback state status with a mutable React Ref to eliminate stale closure issues in window-level gesture handlers
  const playbackStatusRef = useRef(playbackState.status);
  useEffect(() => {
    playbackStatusRef.current = playbackState.status;
  }, [playbackState.status]);

  // Command sender function to update iframe state without reload
  const sendPlayerCommand = (func: string, args: any[] = []) => {
    const ids = ['musesync-yt-player-visible', 'musesync-yt-player-bk'];
    ids.forEach(id => {
      const iframe = document.getElementById(id) as HTMLIFrameElement | null;
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage(
            JSON.stringify({
              event: 'command',
              func: func,
              args: args
            }),
            '*'
          );
        } catch (e) {
          console.warn(`[YouTube API Controller] Failed to post message to ${id}:`, e);
        }
      }
    });
  };

  // Keep a stable iframe source that ONLY reloads when the track ID transitions OR major playback mode changes.
  // This completely prevents resetting the music back to 0s upon minor state updates.
  useEffect(() => {
    if (!currentTrack) {
      setIframeSrc('');
      lastTrackIdRef.current = null;
      return;
    }

    if (currentTrack.id !== lastTrackIdRef.current) {
      lastTrackIdRef.current = currentTrack.id;
      const autoplay = playbackState.status === 'playing' ? '1' : '0';
      const mute = audioPlaybackMode === 'routed' ? '1' : (muted ? '1' : '0');
      const startSec = Math.floor(playbackState.progress) || 0;
      const url = `https://www.youtube.com/embed/${currentTrack.youtubeId}?autoplay=${autoplay}&mute=${mute}&start=${startSec}&controls=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
      setIframeSrc(url);
    }
  }, [currentTrack?.id, audioPlaybackMode]);

  // Synchronize play/pause state in real-time without reloading the iframe!
  useEffect(() => {
    if (!currentTrack || !iframeSrc) return;

    const syncPlayerState = () => {
      if (playbackState.status === 'playing') {
        sendPlayerCommand('playVideo');
      } else {
        sendPlayerCommand('pauseVideo');
      }

      const shouldMute = audioPlaybackMode === 'routed' || muted;
      if (shouldMute) {
        sendPlayerCommand('mute');
      } else {
        sendPlayerCommand('unMute');
        sendPlayerCommand('setVolume', [playbackState.volume]);
      }
    };

    syncPlayerState();
    // Re-trigger slightly after to safeguard iframe bootstrap window
    const t1 = setTimeout(syncPlayerState, 800);
    const t2 = setTimeout(syncPlayerState, 2000);
    const t3 = setTimeout(syncPlayerState, 4500); // Slower networks
    const interval = setInterval(syncPlayerState, 8000); // Fallback sync

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearInterval(interval);
    };
  }, [playbackState.status, muted, playbackState.volume, audioPlaybackMode, iframeSrc, userGestureActive]);

  useEffect(() => {
    // Instantiate stable client audio component
    const audio = new Audio();
    // Do NOT set crossOrigin = 'anonymous' to prevent CORS block on standard media stream links
    audio.volume = playbackState.volume / 100;
    audioRef.current = audio;

    // Retrieve and restore saved sound sinkId
    const storedDeviceId = localStorage.getItem('wavetune_output_device_id');
    if (storedDeviceId && storedDeviceId !== 'default' && 'setSinkId' in audio) {
      (audio as any).setSinkId(storedDeviceId)
        .then(() => console.log('Successfully synced output sink to stored system choice'))
        .catch((err: any) => console.warn('Stored speaker output sync failed:', err));
    }

    // Auto-unlock audio playback silently upon first user interactions based on dynamic status reference
    const handleGesture = () => {
      setUserGestureActive(true);
      if (audio && playbackStatusRef.current === 'playing' && audio.paused) {
        audio.play().catch((err) => console.log('[Autoplay Unlock] Playback bypass postponed:', err));
      }
    };
    window.addEventListener('click', handleGesture);
    window.addEventListener('touchstart', handleGesture);

    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  // Dynamically resolve high-quality streamable YouTube audio for selected output speaker routing
  useEffect(() => {
    if (!currentTrack) {
      setResolvedAudioUrl('');
      return;
    }

    // Bypassing third-party server-side/client-side audio stream loaders completely when running in default YouTube frame mode
    if (audioPlaybackMode === 'youtube') {
      setResolvedAudioUrl('');
      return;
    }

    // Do NOT pre-populate with SoundHelix or Apple previews to avoid playing a "demo sound"
    // Instead, start fresh and fetch the real, full high-quality audio stream
    setResolvedAudioUrl('');

    let isCurrent = true;

    const resolveStream = async () => {
      // 1. Try our high-reliability server-level proxy endpoint first (CORS-free, registry-grounded)
      try {
        console.log(`[YouTube Audio Player] Attempting server-side stream resolution for ID: ${currentTrack.youtubeId}`);
        const res = await fetch(`/api/resolve-stream/${currentTrack.youtubeId}`);
        if (res.ok && isCurrent) {
          const data = await res.json();
          if (data && data.streamUrl) {
            console.log(`[YouTube Audio Player] Successfully resolved high-reliability server stream link!`);
            setResolvedAudioUrl(data.streamUrl);
            return;
          }
        }
      } catch (serverErr) {
        console.warn('[YouTube Audio Player] Server-side resolution failed, entering client fallback:', serverErr);
      }

      // 2. Client-side fallback pool
      const providers = [
        `https://pipedapi.kavin.rocks/streams/${currentTrack.youtubeId}`,
        `https://api.piped.yt/streams/${currentTrack.youtubeId}`,
        `https://piped-api.lunar.icu/streams/${currentTrack.youtubeId}`,
        `https://pipedapi.tokhmi.xyz/streams/${currentTrack.youtubeId}`
      ];

      for (const url of providers) {
        if (!isCurrent) return;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s fast timeout

          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok && isCurrent) {
            const data = await res.json();
            if (data.audioStreams && data.audioStreams.length > 0) {
              const sorted = data.audioStreams.sort((a: any, b: any) => b.bitrate - a.bitrate);
              const best = sorted[0];
              if (best && best.url && isCurrent) {
                console.log(`[YouTube Audio Player] Client fallback successfully resolved stream link:`, best.url);
                setResolvedAudioUrl(best.url);
                return;
              }
            }
          }
        } catch (err) {
          console.warn(`Piped audio search mirror failed to load: ${url}`, err);
        }
      }

      // 3. Fallback: If both server-side and client-side direct streams failed, auto-switch to Default Speaker Mode (YouTube native)
      // This prevents the player from remaining silent or requiring manual intervention
      if (isCurrent && audioPlaybackMode === 'routed') {
        console.warn('[YouTube Audio Player] Direct audio stream resolution failed. Auto-routing to Default Speaker (YouTube native) mode to play the original track.');
        onAlert('Direct audio stream unavailable. Falling back to Default Speaker Mode to play original track.', 'success');
        setAudioPlaybackMode('youtube');
        localStorage.setItem('wavetune_audio_playback_mode', 'youtube');
      }
    };

    // ALWAYS query full audio stream resolution regardless of 30s preview presence to play the proper full selected track
    resolveStream();

    return () => {
      isCurrent = false;
    };
  }, [currentTrack, audioPlaybackMode]);

  // Synchronize master output properties (vol, mute)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audioPlaybackMode === 'routed') {
      audio.volume = muted ? 0 : playbackState.volume / 100;
    } else {
      audio.volume = 0; // Completely muted when playing through the YouTube iframe to prevent overlapping echo!
    }
  }, [playbackState.volume, muted, audioPlaybackMode]);

  // Synchronize playing stream source & state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playbackState.status === 'playing' && resolvedAudioUrl && audioPlaybackMode === 'routed') {
      const storedDeviceId = localStorage.getItem('wavetune_output_device_id') || 'default';
      
      const startPlayback = () => {
        audio.play()
          .then(() => {
            console.log('[Speaker Play] Audio started playing successfully');
          })
          .catch((err) => {
            console.warn('Browser policy blocked direct audio play, waiting for user gesture/click:', err);
          });
      };

      if (audio.src !== resolvedAudioUrl) {
        audio.src = resolvedAudioUrl;
        audio.load();
        audio.currentTime = localProgress;
        
        // Re-apply sinkId immediately after setting src/loading because load() resets it
        if (storedDeviceId !== 'default' && 'setSinkId' in audio) {
          (audio as any).setSinkId(storedDeviceId)
            .then(() => {
              console.log(`[Playback Stream] Audio sink successfully bound to device: ${storedDeviceId}`);
              startPlayback();
            })
            .catch((err: any) => {
              console.warn('[Playback Stream] setSinkId failed upon src change, trying direct start:', err);
              startPlayback();
            });
        } else {
          startPlayback();
        }
      } else {
        // Source is same, but let's double-check sinkId compliance and play
        if (storedDeviceId !== 'default' && 'setSinkId' in audio) {
          (audio as any).setSinkId(storedDeviceId)
            .then(() => startPlayback())
            .catch(() => startPlayback());
        } else {
          startPlayback();
        }
      }
    } else {
      audio.pause();
    }
  }, [playbackState.status, resolvedAudioUrl, audioPlaybackMode]);

  // Keep audio.currentTime aligned with localProgress state to handle skips/seeks
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || audioPlaybackMode !== 'routed' || playbackState.status !== 'playing') return;

    if (Math.abs(audio.currentTime - localProgress) > 3) {
      console.log(`[Audio Seek] Drift detected (${Math.round(audio.currentTime)}s vs ${localProgress}s), syncing...`);
      audio.currentTime = localProgress;
    }
  }, [localProgress, audioPlaybackMode, playbackState.status]);

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
      if (audioPlaybackMode === 'youtube') {
        sendPlayerCommand('seekTo', [playbackState.progress, true]);
      }
    }
  }, [playbackState.progress, audioPlaybackMode]);

  // Synchronize active device pairing state from synced playback state across page reloads
  useEffect(() => {
    const storedId = localStorage.getItem('musesync_device_uuid');
    if (storedId && playbackState.activeDeviceId === storedId) {
      setIsPaired(true);
      if (!pairedHost) {
        setPairedHost('Active Session Host');
      }
    } else {
      setIsPaired(false);
    }
  }, [playbackState.activeDeviceId, pairedHost]);

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
    // Mute YouTube completely if we are routing audio to custom hardware output speakers, to prevent dual sound!
    const mute = audioPlaybackMode === 'routed' ? '1' : (muted ? '1' : '0');
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
              <div className="relative group aspect-square w-64 md:w-80 rounded-2xl overflow-hidden border border-white/15 bg-black shadow-[0_15px_45px_rgba(0,0,0,0.6)]">
                {audioPlaybackMode === 'youtube' ? (
                  <iframe
                    id="musesync-yt-player-visible"
                    src={iframeSrc}
                    className="w-full h-full border-0 absolute inset-0"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    title="Active Video Player"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <>
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
                  </>
                )}
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

              {/* High visibility interactive gesture unlock overlay */}
              {!userGestureActive && playbackState.status === 'playing' && (
                <button
                  type="button"
                  onClick={() => setUserGestureActive(true)}
                  className="w-full text-center py-2.5 px-4 border border-pink-500/20 bg-pink-500/10 text-pink-600 dark:text-pink-400 rounded-xl text-xs font-mono font-bold animate-pulse hover:bg-pink-500/25 transition-all cursor-pointer"
                >
                  🎧 Click here to unlock autoplay audio & start streaming sound!
                </button>
              )}

              {/* Hidden background YouTube Player to process native playback of selected music without showing video */}
              {audioPlaybackMode === 'routed' && currentTrack.youtubeId && (
                <div 
                  style={{ 
                    position: 'absolute', 
                    width: '1px', 
                    height: '1px', 
                    padding: '0', 
                    margin: '-1px',
                    overflow: 'hidden', 
                    clip: 'rect(0, 0, 0, 0)', 
                    whiteSpace: 'nowrap', 
                    border: '0',
                    opacity: 0,
                    pointerEvents: 'none'
                  }}
                >
                  <iframe
                    id="musesync-yt-player-bk"
                    src={iframeSrc}
                    className="w-full h-full"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    title="Hidden Track Player"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {/* Playback Routing Protocol Tab Selector & Quick Mute Actions */}
              <div className={`p-4 rounded-xl border text-left space-y-4 ${
                theme === 'light'
                  ? 'bg-neutral-50/50 border-neutral-200'
                  : 'bg-zinc-900/40 border-white/5'
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-pink-500">
                    🔌 Dual Audio Playback Mode
                  </label>
                  <button
                    onClick={() => setMuted(!muted)}
                    className={`py-1 px-2.5 rounded-lg border text-[10px] font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                      muted 
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/25'
                        : 'bg-neutral-200/50 hover:bg-neutral-200 border-neutral-350 dark:bg-zinc-800 dark:border-white/10 dark:hover:bg-zinc-700 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    {muted ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-rose-500" /> Unmute Player
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-pink-400" /> Mute Player
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5 p-0.5 rounded-lg bg-neutral-200 dark:bg-black/50">
                  <button
                    type="button"
                    onClick={() => {
                      setAudioPlaybackMode('routed');
                      localStorage.setItem('wavetune_audio_playback_mode', 'routed');
                      onAlert('Custom audio speaker routing selected.', 'success');
                    }}
                    className={`py-1.5 text-[10px] font-mono tracking-tight font-bold rounded-md transition-all cursor-pointer ${
                      audioPlaybackMode === 'routed'
                        ? 'bg-neutral-900 text-white dark:bg-neutral-800 dark:text-white shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white'
                    }`}
                  >
                    🔊 Speaker Routing Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAudioPlaybackMode('youtube');
                      localStorage.setItem('wavetune_audio_playback_mode', 'youtube');
                      onAlert('Full YouTube Video audio output selected.', 'success');
                    }}
                    className={`py-1.5 text-[10px] font-mono tracking-tight font-bold rounded-md transition-all cursor-pointer ${
                      audioPlaybackMode === 'youtube'
                        ? 'bg-neutral-900 text-white dark:bg-neutral-800 dark:text-white shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white'
                    }`}
                  >
                    📺 Default Speaker Mode
                  </button>
                </div>
                <p className="text-[9px] font-mono px-1 opacity-70 text-neutral-500 dark:text-neutral-400 leading-normal">
                  {audioPlaybackMode === 'routed' 
                    ? '* Plays independent audio stream on your picked custom output hardware (dropdown below).'
                    : '* Plays full video/audio on the default output speaker only (setSinkId blocked by browser).'
                  }
                </p>
              </div>

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
