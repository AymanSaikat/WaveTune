import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Track, PlaybackState, PairedDevice } from '../types';
import { apiFetch } from '../utils';
import GlassCard from './GlassCard';
import WaveTuneLogo from './WaveTuneLogo';
import {
  Play,
  Pause,
  SkipForward,
  Trash2,
  Tv,
  ArrowUp,
  ArrowDown,
  Volume2,
  VolumeX,
  Radio,
  Plus,
  Loader2,
  Sparkles,
  Smartphone,
  ExternalLink,
  Lock,
  Key,
  LogOut,
  Sun,
  Moon,
  RefreshCw,
  History,
  Clock
} from 'lucide-react';

interface AdminViewProps {
  socket: Socket | null;
  queue: Track[];
  playbackState: PlaybackState;
  devices: PairedDevice[];
  onAlert: (msg: string, type: 'success' | 'error') => void;
  onLogout?: () => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export default function AdminView({ socket, queue, playbackState, devices, onAlert, onLogout, theme, setTheme }: AdminViewProps) {
  const [pairingCodeInput, setPairingCodeInput] = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [djName, setDjName] = useState(() => localStorage.getItem('sonicstream_dj_name') || 'Ayman Saikat');
  
  // Login administrative system state
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('sonicstream_admin_token') === 'sonicstream-admin-authenticated-token';
  });

  const [activeSubTab, setActiveSubTab] = useState<'queue' | 'history'>('queue');
  const [mobileTab, setMobileTab] = useState<'deck' | 'queue'>('deck');
  const [historyList, setHistoryList] = useState<Track[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await apiFetch('/api/admin/history');
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data.history || []);
      } else {
        onAlert('Failed to load playback history from server.', 'error');
      }
    } catch (err) {
      onAlert('Failed to connect to server history endpoint.', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleTabChange = (tab: 'queue' | 'history') => {
    setActiveSubTab(tab);
    if (tab === 'history') {
      fetchHistory();
    }
  };

  useEffect(() => {
    if (activeSubTab === 'history') {
      fetchHistory();
    }
  }, [queue, activeSubTab]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const currentlyPlaying = queue.find(t => t.id === playbackState.currentTrackId && t.status === 'playing');
  const activeDevice = devices.find(d => d.deviceId === playbackState.activeDeviceId);

  // Trigger global control commands
  const sendControl = (action: 'play' | 'pause' | 'skip' | 'volume' | 'select_track', targetTrackId?: string, value?: any) => {
    if (!socket) return;
    socket.emit('playback_control', { action, targetTrackId, value });
  };

  // Pair a device by numeric 4 digit code
  const handlePairDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingCodeInput.trim() || !socket) return;

    setIsPairing(true);
    socket.emit(
      'pair_device',
      { code: pairingCodeInput.trim(), adminName: djName },
      (res: { success: boolean; device?: PairedDevice; error?: string }) => {
        setIsPairing(false);
        if (res.success) {
          onAlert(`Successfully linked to active target: "${res.device?.deviceName}"`, 'success');
          setPairingCodeInput('');
        } else {
          onAlert(res.error || 'Pairing target not found or code expired.', 'error');
        }
      }
    );
  };

  // Delete tracks from CMS
  const handleDeleteTrack = (id: string) => {
    if (!socket) return;
    socket.emit('delete_track', id);
    onAlert('Track removed from play queue.', 'success');
  };

  // Manual re-sorting queue handler. Move item up or down in queue list
  const handleShiftPosition = (index: number, direction: 'up' | 'down') => {
    if (!socket) return;

    const remainingQueued = queue.filter(t => t.status === 'queued');
    if (index < 0 || index >= remainingQueued.length) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= remainingQueued.length) return;

    // Swap
    const reorderedList = [...remainingQueued];
    const temp = reorderedList[index];
    reorderedList[index] = reorderedList[targetIndex];
    reorderedList[targetIndex] = temp;

    // Extract item IDs and emit in order
    const idsInOrder = reorderedList.map(t => t.id);
    socket.emit('reorder_queue', idsInOrder);
  };

  // Login Form Submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoggingIn(true);
    try {
      const res = await apiFetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('sonicstream_admin_token', data.token);
        setIsAuthenticated(true);
        onAlert('CMS System authenticated successfully.', 'success');
      } else {
        onAlert(data.error || 'Invalid administrator password.', 'error');
      }
    } catch (err) {
      onAlert('Failed to connect to authentication server.', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sonicstream_admin_token');
    setIsAuthenticated(false);
    setPassword('');
    onAlert('Logged out of system administrator panel.', 'success');
    if (onLogout) {
      onLogout();
    }
  };

  // Formatter for seconds
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const pendingQueue = queue.filter(t => t.status === 'queued');

  // Enforce system login gates for control access
  if (!isAuthenticated) {
    return (
      <div className={`flex items-center justify-center min-h-[60vh] px-4 animate-fade-in relative z-10 ${theme === 'light' ? 'text-neutral-900' : 'text-white'}`}>
        <div className={`absolute inset-0 blur-[125px] rounded-full scale-75 pointer-events-none transition-all duration-300 ${theme === 'light' ? 'bg-neutral-200/50' : 'bg-white/5'}`} />
        <GlassCard theme={theme} className="p-8 max-w-md w-full relative z-20 shadow-2xl rounded-3xl border border-neutral-300/30">
          
          {/* Corner theme switcher */}
          <div className="absolute top-4 right-4 z-30">
            <button
              onClick={toggleTheme}
              type="button"
              className={`p-2.5 rounded-xl transition-all cursor-pointer border ${
                theme === 'light'
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
              }`}
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>

          <div className="text-center mb-8">
            <div className={`w-14 h-14 border rounded-2xl flex items-center justify-center mx-auto mb-4 ${
              theme === 'light' ? 'bg-neutral-100 border-neutral-300 text-neutral-800' : 'bg-white/10 border-white/10 text-white'
            }`}>
              <Lock className="w-6 h-6 animate-pulse" />
            </div>
            <h2 className={`text-2xl font-bold font-sans tracking-tight ${theme === 'light' ? 'text-black' : 'text-white'}`}>System Login</h2>
            <p className={`text-xs mt-2 font-sans leading-relaxed ${theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'}`}>
              Enter the administrator passcode to access the live deck console and CMS.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-widest mb-2 ${theme === 'light' ? 'text-neutral-500' : 'text-white/40'}`}>
                Passcode
              </label>
              <div className="relative">
                <Key className={`absolute left-4 top-3.5 w-4 h-4 ${theme === 'light' ? 'text-neutral-400' : 'text-white/20'}`} />
                <input
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full border rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none transition-all font-sans ${
                    theme === 'light'
                      ? 'bg-neutral-100 border-neutral-300 text-neutral-900 placeholder-neutral-450 focus:border-black'
                      : 'bg-white/10 border-white/15 text-white placeholder-white/25 focus:border-white/30'
                  }`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className={`w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-lg mt-6 ${
                theme === 'light'
                  ? 'bg-black text-white hover:bg-neutral-800'
                  : 'bg-white text-black hover:bg-neutral-200'
              }`}
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className={`w-4 h-4 animate-spin ${theme === 'light' ? 'text-white' : 'text-black'}`} /> Authenticating...
                </>
              ) : (
                <>
                  Unlock CMS Console
                </>
              )}
            </button>
          </form>

          <div className={`mt-8 pt-4 border-t text-[10px] font-mono text-center uppercase tracking-wider ${
            theme === 'light' ? 'border-neutral-200 text-neutral-450' : 'border-white/5 text-neutral-500'
          }`}>
            Protected Admin Terminal Gate
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans ${
      theme === 'light' 
        ? 'bg-[#F2F2F7] text-neutral-900' 
        : 'bg-black text-[#F5F5F7]'
    } transition-all duration-300 relative flex flex-col`}>

      {/* =========================================
          1. IMMERSIVE NATIVE iOS MOBILE APP VIEW 
             - Overrides parent layout limits on mobile.
             - Styled with absolute iOS status, navigation bottom bars, 
               and table-view lists.
         ========================================= */}
      <div className="lg:hidden flex flex-col w-full bg-[#F2F2F7] dark:bg-black relative select-none pb-28 pt-2 px-4">
        
        {/* Top Segmented Control Pill for DJ Console Tab: Live Player vs Screen Queue */}
        <div className="flex p-0.5 bg-neutral-250/80 dark:bg-neutral-900 rounded-full border border-neutral-300/30 dark:border-white/5 shadow-inner mb-4 mt-1">
          <button
            type="button"
            onClick={() => setMobileTab('deck')}
            className={`flex-1 py-2 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mobileTab === 'deck'
                ? 'bg-white dark:bg-[#323236] text-black dark:text-white shadow font-extrabold'
                : 'text-neutral-500 hover:text-black dark:text-neutral-400'
            }`}
          >
            <Radio className="w-3.5 h-3.5" /> Live Player
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('queue')}
            className={`flex-1 py-2 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mobileTab === 'queue'
                ? 'bg-white dark:bg-[#323236] text-black dark:text-white shadow font-extrabold'
                : 'text-neutral-500 hover:text-black dark:text-neutral-400'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Stream Queue
          </button>
        </div>

        {/* Scrollable iOS Content Container */}
        <div className="flex-1 pb-4">
          
          {/* MOBILE TAB CONTENT A: DECK PLAYER */}
          {mobileTab === 'deck' && (
            <div className="space-y-6">
              
              {/* iOS Expanded Album Music Sheet */}
              <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-5 border border-neutral-250/20 dark:border-white/5 shadow-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/5 to-purple-500/10 pointer-events-none" />
                
                {currentlyPlaying ? (
                  <div className="space-y-6 relative z-10">
                    
                    {/* Immersive Rotating CD/Vinyl Cover Art */}
                    <div className="flex flex-col items-center justify-center py-4">
                      <div className="relative">
                        <div 
                          className="w-48 h-48 rounded-full flex items-center justify-center relative border border-neutral-300 dark:border-white/15 bg-neutral-900 shadow-2xl"
                          style={{
                            animation: playbackState.status === 'playing' ? 'spin 12s linear infinite' : 'none'
                          }}
                        >
                          {/* Radial Vinyl Grooves */}
                          <div className="absolute inset-2 border border-black/35 rounded-full"></div>
                          <div className="absolute inset-6 border border-white/5 rounded-full"></div>
                          <div className="absolute inset-12 border border-black/50 rounded-full flex items-center justify-center text-[7px] font-mono text-white/10 tracking-widest uppercase">SONIC STREAM</div>
                          
                          {/* Center Artwork Image */}
                          <img
                            src={currentlyPlaying.artworkUrl}
                            alt={currentlyPlaying.title}
                            referrerPolicy="no-referrer"
                            className="w-28 h-28 rounded-full object-cover border-4 border-black shadow-lg relative z-10"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600';
                            }}
                          />
                          <div className="absolute w-3 h-3 bg-neutral-900 border border-white/20 rounded-full z-20 shadow-inner"></div>
                        </div>

                        {/* Interactive pickup cartridge needles */}
                        <div 
                          className="absolute -top-3 -right-2 w-12 h-20 origin-top-left transition-transform duration-700 pointer-events-none z-20"
                          style={{
                            transform: playbackState.status === 'playing' ? 'rotate(18deg)' : 'rotate(-2deg)'
                          }}
                        >
                          <div className="absolute left-0 top-0 w-3 h-3 bg-neutral-400 rounded-full border border-white/20 shadow animate-fade-in"></div>
                          <div className="absolute left-1 top-2 w-0.5 h-12 bg-neutral-400"></div>
                          <div className="absolute left-0 top-13 w-2.5 h-4 bg-neutral-300 rounded-sm shadow-sm rotate-[10deg]"></div>
                        </div>
                      </div>

                      {playbackState.status === 'playing' ? (
                        <div className="flex items-end justify-center gap-1.5 h-6 mt-5">
                          <span className="w-1 bg-[#FF2D55] rounded-full animate-bounce h-[65%] [animation-duration:1.1s]"></span>
                          <span className="w-1 bg-[#AF52DE] rounded-full animate-bounce h-[95%] [animation-duration:0.7s]"></span>
                          <span className="w-1 bg-[#5856D6] rounded-full animate-bounce h-[45%] [animation-duration:1.4s]"></span>
                          <span className="w-1 bg-[#FF2D55] rounded-full animate-bounce h-[75%] [animation-duration:0.9s]"></span>
                        </div>
                      ) : (
                        <div className="h-6 mt-5 flex items-center">
                          <span className="text-[9px] uppercase font-mono text-neutral-400 dark:text-neutral-500 font-bold tracking-widest">Deck Paused</span>
                        </div>
                      )}
                    </div>

                    {/* Metadata Header text */}
                    <div className="text-center space-y-1">
                      <h3 className="text-lg font-extrabold tracking-tight text-neutral-900 dark:text-white truncate">
                        {currentlyPlaying.title}
                      </h3>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 font-semibold truncate">
                        {currentlyPlaying.artist}
                      </p>
                      
                      <div className="flex items-center justify-center gap-2 pt-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-pink-500/10 text-[#FF2D55] border border-pink-500/20">
                          Req: {currentlyPlaying.requestedBy}
                        </span>
                        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#AF52DE]/10 text-[#AF52DE] border border-[#AF52DE]/20 font-bold">
                          Votes: {currentlyPlaying.votes}
                        </span>
                      </div>
                    </div>

                    {/* Rich Original Metadata details */}
                    <div className={`p-4 rounded-xl border text-left text-xs ${
                      theme === 'light' ? 'bg-neutral-50/70 border-neutral-200/80 text-neutral-800' : 'bg-black/25 border-white/5 text-neutral-300'
                    }`}>
                      <div className="flex justify-between items-center py-1.5 border-b border-dashed border-neutral-500/10">
                        <span className="text-neutral-400 font-medium">Original Title</span>
                        <span className="font-semibold text-right max-w-[170px] truncate">{currentlyPlaying.originalName || currentlyPlaying.title}</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-dashed border-neutral-500/10">
                        <span className="text-neutral-400 font-medium">Original Artist</span>
                        <span className="font-semibold text-right max-w-[170px] truncate">{currentlyPlaying.originalArtist || currentlyPlaying.artist}</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-dashed border-neutral-500/10">
                        <span className="text-neutral-400 font-medium">Record Label</span>
                        <span className="font-mono font-bold text-[#FF2D55] text-right max-w-[170px] truncate">{currentlyPlaying.originalLabel || "Sony Music Enterprise"}</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-neutral-400 font-medium">Artwork Source</span>
                        <a 
                          href={currentlyPlaying.originalCover || currentlyPlaying.artworkUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-bold text-pink-500 hover:underline text-right"
                        >
                          View High-Res Art ↗
                        </a>
                      </div>
                    </div>

                    {/* iOS Progressive Slider */}
                    <div className="space-y-1.5 px-2">
                      <div className="w-full h-1 bg-neutral-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#FF2D55] to-[#AF52DE]" 
                          style={{ width: `${Math.min(100, (playbackState.progress / (currentlyPlaying.duration || 1)) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-neutral-400 dark:text-neutral-500 font-bold">
                        <span>{formatTime(playbackState.progress)}</span>
                        <span>{formatTime(currentlyPlaying.duration)}</span>
                      </div>
                    </div>

                    {/* Massive Tactile Apple Play Buttons */}
                    <div className="flex items-center justify-around pt-2">
                      <button
                        onClick={() => sendControl('play')}
                        type="button"
                        className="p-3.5 bg-neutral-100 dark:bg-white/5 text-neutral-700 dark:text-neutral-300 rounded-full active:scale-90 transition-all cursor-pointer"
                        title="Restart Track"
                      >
                        <Clock className="w-5 h-5 text-neutral-400" />
                      </button>

                      {playbackState.status === 'playing' ? (
                        <button
                          onClick={() => sendControl('pause')}
                          type="button"
                          className="w-16 h-16 rounded-full bg-[#FF2D55] flex items-center justify-center text-white shadow-lg shadow-pink-500/20 active:scale-90 transition-transform cursor-pointer"
                        >
                          <Pause className="w-7 h-7 fill-current" />
                        </button>
                      ) : (
                        <button
                          onClick={() => sendControl('play')}
                          type="button"
                          className="w-16 h-16 rounded-full bg-neutral-900 dark:bg-white flex items-center justify-center text-white dark:text-black shadow-lg active:scale-90 transition-transform cursor-pointer"
                        >
                          <Play className="w-7 h-7 fill-current ml-1" />
                        </button>
                      )}

                      <button
                        onClick={() => sendControl('skip')}
                        type="button"
                        className="p-3.5 bg-neutral-150 dark:bg-white/15 text-neutral-700 dark:text-white rounded-full active:scale-90 transition-all cursor-pointer"
                      >
                        <SkipForward className="w-5 h-5 fill-current" />
                      </button>
                    </div>

                  </div>
                ) : (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-14 h-14 rounded-full bg-[#FF2D55]/10 flex items-center justify-center mx-auto text-[#FF2D55] animate-pulse">
                      <Plus className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="font-extrabold text-sm text-neutral-900 dark:text-white">Live Broadcast Plate Muted</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">There are no active songs currently spooling.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => sendControl('play')}
                      className="px-6 py-2.5 rounded-full bg-[#FF2D55] text-white font-extrabold text-xs tracking-wider uppercase hover:shadow-lg hover:shadow-pink-500/25 transition-all text-center cursor-pointer"
                    >
                      Start Airing Play
                    </button>
                  </div>
                )}
              </div>

              {/* iOS Style Quick Volume Controller Section */}
              <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-5 border border-neutral-250/20 dark:border-white/5 shadow-md">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-2 font-sans">
                  <span className="flex items-center gap-1">
                    <Volume2 className="w-4 h-4 text-[#FF2D55]" /> Speaker Output
                  </span>
                  <span className="font-mono text-[#FF2D55] font-extrabold">
                    {playbackState.volume === 0 ? 'MUTED' : `${playbackState.volume}%`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <VolumeX className="w-4 h-4 text-neutral-400 dark:text-neutral-600 shrink-0" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={playbackState.volume}
                    onChange={(e) => sendControl('volume', undefined, parseInt(e.target.value))}
                    className="flex-1 accent-[#FF2D55] h-1.5 dark:bg-neutral-800 rounded-full cursor-pointer"
                  />
                  <Volume2 className="w-4 h-4 text-neutral-400 dark:text-neutral-600 shrink-0" />
                </div>

                {/* Speaker presets Grid */}
                <div className="grid grid-cols-4 gap-2 mt-4">
                  {[0, 30, 75, 100].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => sendControl('volume', undefined, v)}
                      className={`py-2 rounded-xl text-[10px] font-bold font-mono transition-all border ${
                        playbackState.volume === v 
                          ? 'bg-[#FF2D55] text-white border-transparent shadow' 
                          : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-white/5'
                      }`}
                    >
                      {v === 0 ? 'MUTE' : v === 100 ? 'MAX' : `${v}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* iOS AirPlay Cast Device Pairer */}
              <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-5 border border-neutral-250/20 dark:border-white/5 shadow-md">
                <h3 className="text-sm font-extrabold text-neutral-900 dark:text-white mb-1 tracking-tight">Secondary Cast Platter</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 leading-relaxed font-semibold">Link an external player with a 4-digit code:</p>
                
                <form onSubmit={handlePairDevice} className="flex flex-col min-[380px]:flex-row gap-2.5 w-full">
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="Enter 4-digit code (e.g. 5291)"
                    required
                    value={pairingCodeInput}
                    onChange={(e) => setPairingCodeInput(e.target.value.replace(/\D/g, ''))}
                    className={`flex-1 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-black rounded-2xl px-4 py-2.5 text-center transition-all focus:outline-none focus:ring-2 focus:ring-[#FF2D55] focus:border-[#FF2D55] ${
                      pairingCodeInput 
                        ? 'text-lg font-mono font-black tracking-widest text-[#FF2D55]' 
                        : 'text-xs text-neutral-400 dark:text-neutral-500 tracking-normal font-semibold'
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={isPairing}
                    className="w-full min-[380px]:w-auto px-5 py-3 min-[380px]:py-0 text-xs font-bold rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-50 transition-all shrink-0 cursor-pointer flex items-center justify-center min-h-[44px]"
                  >
                    {isPairing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cast Link'}
                  </button>
                </form>

                {activeDevice && activeDevice.isOnline ? (
                  <div className="mt-4 flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 p-3.5 rounded-2xl gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Smartphone className="w-4 h-4 shrink-0 text-emerald-500" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{activeDevice.deviceName}</p>
                        <p className="text-[10px] font-medium opacity-80 tracking-tight font-mono">LINKED • ROUTING BROADCAST</p>
                      </div>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse block shrink-0" />
                  </div>
                ) : (
                  <div className="mt-4 text-center py-2.5 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl px-2">
                    <p className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wide leading-tight">Playing Locally • No Air Cast paired</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* MOBILE TAB CONTENT B: LISTS & QUEUE LOGISTICS */}
          {mobileTab === 'queue' && (
            <div className="space-y-5">
              
              {/* Top iOS Segmented Pill Controller (UISegmentedControl style) */}
              <div className="flex p-0.5 bg-neutral-200/80 dark:bg-neutral-900 rounded-full border border-neutral-300/30 dark:border-white/5 shadow-inner">
                <button
                  type="button"
                  onClick={() => handleTabChange('queue')}
                  className={`flex-1 py-2 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-1.5 ${
                    activeSubTab === 'queue'
                      ? 'bg-white dark:bg-[#323236] text-black dark:text-white shadow font-extrabold'
                      : 'text-neutral-500 hover:text-black dark:text-neutral-400'
                  }`}
                >
                  <Radio className="w-3 h-3" /> Active Queue ({pendingQueue.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('history')}
                  className={`flex-1 py-2 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-1.5 ${
                    activeSubTab === 'history'
                      ? 'bg-white dark:bg-[#323236] text-black dark:text-white shadow font-extrabold'
                      : 'text-neutral-500 hover:text-black dark:text-neutral-400'
                  }`}
                >
                  <History className="w-3 h-3" /> History Logs
                </button>
              </div>

              {activeSubTab === 'queue' ? (
                pendingQueue.length === 0 ? (
                  <div className="text-center py-16 space-y-3 bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 border border-neutral-200 dark:border-white/5">
                    <Sparkles className="w-10 h-10 mx-auto text-neutral-300 dark:text-neutral-700 animate-spin [animation-duration:10s]" />
                    <p className="font-extrabold text-sm text-neutral-900 dark:text-white">Logistics Plate Clear</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto leading-relaxed">
                      Active song requests cast by guests on the smart interface will lock in here in real-time.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingQueue.map((track, idx) => (
                      <div 
                        key={track.id}
                        className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 border border-neutral-200/50 dark:border-white/5 shadow-sm space-y-3.5 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={track.artworkUrl}
                            alt={track.title}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-xl object-cover shrink-0 border border-neutral-200 dark:border-neutral-800"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600';
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-extrabold text-neutral-900 dark:text-white truncate tracking-tight">{track.title}</h4>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold truncate mt-0.5">{track.artist}</p>
                            
                            <div className="flex items-center gap-1.5 mt-1 text-[9px] font-mono font-bold">
                              <span className="text-[#FF2D55] truncate max-w-[100px]">By: {track.requestedBy}</span>
                              <span className="text-neutral-300 dark:text-neutral-700">•</span>
                              <span className="text-neutral-500 font-bold">{formatTime(track.duration)}</span>
                              <span className="text-neutral-300 dark:text-neutral-700">•</span>
                              <span className="bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded text-neutral-600 dark:text-neutral-400">v: {track.votes}</span>
                            </div>
                          </div>

                          {/* Quick Tactile Arrow Shifters for Queue position manipulation */}
                          <div className="flex flex-col bg-neutral-100 dark:bg-neutral-950 p-1 rounded-xl gap-1 shrink-0 border border-neutral-200 dark:border-white/5">
                            <button
                              onClick={() => handleShiftPosition(idx, 'up')}
                              disabled={idx === 0}
                              type="button"
                              className="p-1 rounded text-neutral-600 dark:text-neutral-400 disabled:opacity-20 active:bg-neutral-200 dark:active:bg-neutral-800 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleShiftPosition(idx, 'down')}
                              disabled={idx === pendingQueue.length - 1}
                              type="button"
                              className="p-1 rounded text-neutral-600 dark:text-neutral-400 disabled:opacity-20 active:bg-neutral-200 dark:active:bg-neutral-800 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Interactive trigger strip */}
                        <div className="flex items-center gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                          <button
                            onClick={() => sendControl('select_track', track.id)}
                            type="button"
                            className="flex-1 py-2 px-3 bg-[#007AFF] text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-transform cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-current text-white" /> Force Play
                          </button>
                          <button
                            onClick={() => handleDeleteTrack(track.id)}
                            type="button"
                            className="py-1.5 px-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 active:scale-95 transition-all shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  {loadingHistory ? (
                    <div className="text-center py-16 space-y-3 bg-white dark:bg-[#1C1C1E] rounded-3xl p-6">
                      <Loader2 className="w-7 h-7 animate-spin mx-auto text-[#FF2D55]" />
                      <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Calling SQL playback database...</p>
                    </div>
                  ) : historyList.length === 0 ? (
                    <div className="text-center py-16 space-y-3 bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 border border-neutral-200 dark:border-white/5">
                      <Clock className="w-9 h-9 mx-auto text-neutral-300 dark:text-neutral-700" />
                      <p className="font-extrabold text-sm text-neutral-900 dark:text-white">Playback Log Pure</p>
                      <p className="text-xs text-[#8E8E93]">Finished tracks populate here instantly.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1 mb-1">
                        <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider">Historical Logs</span>
                        <button
                          type="button"
                          onClick={fetchHistory}
                          className="text-[10px] text-[#007AFF] font-bold"
                        >
                          Refresh Logs
                        </button>
                      </div>
                      {historyList.map((track) => (
                        <div 
                          key={track.id}
                          className="bg-white dark:bg-[#1C1C1E]/60 rounded-2xl p-4 border border-neutral-200/50 dark:border-white/5 shadow-sm flex items-center justify-between text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <img
                              src={track.artworkUrl}
                              alt={track.title}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-lg object-cover shrink-0 border border-neutral-100 dark:border-neutral-900"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600';
                              }}
                            />
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate">{track.title}</h4>
                              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">{track.artist}</p>
                              <p className="text-[9px] font-mono text-neutral-400 dark:text-neutral-550 mt-0.5 truncate">Requested by: {track.requestedBy}</p>
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => {
                              if (socket) {
                                socket.emit('add_request', {
                                  title: track.title,
                                  artist: track.artist,
                                  url: track.url,
                                  youtubeId: track.youtubeId,
                                  artworkUrl: track.artworkUrl,
                                  duration: track.duration,
                                  requestedBy: `Replay (${djName})`,
                                  originalName: track.originalName,
                                  originalArtist: track.originalArtist,
                                  originalCover: track.originalCover,
                                  originalLabel: track.originalLabel
                                });
                                onAlert(`Requeued "${track.title}" from history.`, 'success');
                              }
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-white/5 hover:border-[#FF2D55] text-[10px] font-bold cursor-pointer shrink-0"
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>

      </div>


      {/* =========================================
          2. MACOS MUSIC APP STYLE DESKTOP VIEW 
             - Active on screens 'lg' and larger
             - Sleek double-panel navigation.
         ========================================= */}
      <div className="hidden lg:grid grid-cols-12 min-h-screen relative z-10 w-full">
        
        {/* Left macOS sidebar layout panel */}
        <aside className={`col-span-4 xl:col-span-3 border-r ${
          theme === 'light' 
            ? 'bg-[#EAEAEF]/60 border-[#C6C6C8]/30 text-neutral-800' 
            : 'bg-zinc-950/70 border-white/5 text-zinc-300'
        } backdrop-blur-xl p-6 flex flex-col justify-between overflow-y-auto max-h-screen sticky top-0`}>
          
          <div className="space-y-6">
            
            {/* Branding with standard iOS Music logo aesthetic */}
            <div className="flex items-center gap-3 pb-4 border-b border-neutral-300/20 dark:border-white/5">
              <WaveTuneLogo size="sm" />
              <div className="text-left select-none">
                <span className="text-sm font-black tracking-tight text-neutral-900 dark:text-[#F5F5F7] font-sans">
                  WaveTune CMS
                </span>
                <span className="block text-[9px] font-mono font-bold text-[#FF2D55] tracking-widest uppercase mt-0.5">
                   Broadcast Active
                </span>
              </div>
            </div>

            {/* Config & Profile Details info block */}
            <div className={`p-4 rounded-2xl text-xs space-y-3.5 ${
              theme === 'light' ? 'bg-white shadow-sm border border-neutral-200' : 'bg-white/[0.02] border border-white/5'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">Airing Nickname</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              </div>
              
              <div className="space-y-2">
                <input
                  type="text"
                  className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none font-sans font-bold shadow-inner ${
                    theme === 'light'
                      ? 'bg-neutral-50 border-neutral-300 text-neutral-900 focus:border-black'
                      : 'bg-black/40 border-white/10 text-white focus:border-purple-500'
                  }`}
                  value={djName}
                  onChange={(e) => setDjName(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-medium pt-1.5 text-neutral-400 dark:text-neutral-500 font-sans">
                <span>Console State:</span>
                <span className="font-bold text-[#FF2D55] uppercase font-mono">AUTHORIZED HOST</span>
              </div>
            </div>

            {/* Apple Music Plate Cover & Control layout in sidebar */}
            <div className={`p-4 rounded-2xl ${
              theme === 'light' ? 'bg-white shadow-sm border border-neutral-200' : 'bg-white/[0.02] border border-white/5'
            }`}>
              <span className="text-[10px] font-mono font-bold uppercase text-neutral-400 dark:text-neutral-500 tracking-widest block mb-3">Live Playback state</span>

              {currentlyPlaying ? (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <img
                      src={currentlyPlaying.artworkUrl}
                      alt={currentlyPlaying.title}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-xl object-cover shrink-0 border border-neutral-200 dark:border-neutral-800"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600';
                      }}
                    />
                    <div className="min-w-0 flex-1 text-left">
                      <h4 className="text-xs font-black tracking-tight text-neutral-900 dark:text-white truncate">{currentlyPlaying.title}</h4>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold truncate mt-0.5">{currentlyPlaying.artist}</p>
                      <span className="inline-block mt-1 text-[9px] font-mono uppercase bg-pink-500/10 text-[#FF2D55] px-1.5 py-0.5 rounded font-bold">
                        REQ: {currentlyPlaying.requestedBy}
                      </span>
                    </div>
                  </div>

                  {/* Scrubber slider */}
                  <div className="space-y-1">
                    <div className="w-full h-1 bg-neutral-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[#FF2D55] to-[#AF52DE]" 
                        style={{ width: `${Math.min(100, (playbackState.progress / (currentlyPlaying.duration || 1)) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] font-mono text-neutral-400 dark:text-neutral-500 font-bold">
                      <span>{formatTime(playbackState.progress)}</span>
                      <span>{formatTime(currentlyPlaying.duration)}</span>
                    </div>
                  </div>

                  {/* Controller Play row */}
                  <div className="flex items-center justify-center gap-3 pt-1">
                    <button
                      onClick={() => sendControl('play')}
                      type="button"
                      className="p-2 border rounded-full text-xs font-bold uppercase transition-all bg-neutral-50 dark:bg-neutral-900 border-neutral-250 dark:border-white/5 hover:bg-neutral-200 dark:hover:bg-white/5 text-current cursor-pointer"
                      title="Seek Start"
                    >
                      <Clock className="w-3.5 h-3.5 text-neutral-500" />
                    </button>

                    {playbackState.status === 'playing' ? (
                      <button
                        onClick={() => sendControl('pause')}
                        type="button"
                        className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer bg-[#FF2D55] text-white"
                      >
                        <Pause className="w-4 h-4 fill-current text-white" />
                      </button>
                    ) : (
                      <button
                        onClick={() => sendControl('play')}
                        type="button"
                        className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer bg-neutral-900 dark:bg-white text-white dark:text-black"
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </button>
                    )}

                    <button
                      onClick={() => sendControl('skip')}
                      type="button"
                      className="p-2 border rounded-full transition-all bg-neutral-50 dark:bg-neutral-900 border-neutral-250 dark:border-white/5 hover:bg-neutral-200 dark:hover:bg-white/5 text-current cursor-pointer"
                    >
                      <SkipForward className="w-3.5 h-3.5 text-current fill-current" />
                    </button>
                  </div>

                </div>
              ) : (
                <div className="text-center py-6 text-neutral-400 dark:text-neutral-600 font-mono text-xs">
                  No track on air platter
                </div>
              )}
            </div>

            {/* Output volume sliders block */}
            <div className={`p-4 rounded-2xl ${
              theme === 'light' ? 'bg-white shadow-sm border border-neutral-200' : 'bg-white/[0.015] border border-white/5'
            }`}>
              <div className="flex items-center justify-between text-xs font-semibold mb-2 text-neutral-500 dark:text-neutral-400 animate-fade-in font-sans">
                <span className="flex items-center gap-1.5"><Volume2 className="w-4 h-4 text-[#FF2D55]" /> Output Volume</span>
                <span className="font-mono text-[#FF2D55] font-extrabold">{playbackState.volume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={playbackState.volume}
                onChange={(e) => sendControl('volume', undefined, parseInt(e.target.value))}
                className="w-full accent-[#FF2D55] h-1 bg-neutral-200 dark:bg-neutral-800 rounded-lg cursor-pointer"
              />
              {/* Presets labels */}
              <div className="grid grid-cols-4 gap-1 mt-3">
                {[0, 30, 75, 100].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => sendControl('volume', undefined, v)}
                    className="py-1 text-[9px] font-bold font-mono rounded bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-white/5 transition-all text-center cursor-pointer"
                  >
                    {v === 0 ? 'MUTE' : v === 100 ? 'MAX' : `${v}%`}
                  </button>
                ))}
              </div>
            </div>

          </div>

          <div className="space-y-4 pt-4 border-t border-neutral-300/20 dark:border-white/5">
            {/* Pairing stats */}
            {activeDevice && activeDevice.isOnline ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs space-y-1 text-left">
                <p className="font-bold truncate">✓ Cast Target Enabled</p>
                <p className="opacity-80 font-mono text-[9px] truncate">{activeDevice.deviceName}</p>
              </div>
            ) : (
              <div className="p-3 bg-neutral-200/50 dark:bg-white/[0.01] border border-neutral-200 dark:border-white/5 text-neutral-500 dark:text-neutral-500 rounded-xl text-[10px] font-mono text-left">
                No Cast Device Linkage
              </div>
            )}


          </div>

        </aside>

        {/* Right macOS Table console dashboard (75% Grid Layout) */}
        <main className={`col-span-8 xl:col-span-9 p-8 flex flex-col justify-between ${
          theme === 'light' ? 'bg-[#F2F2F7] text-neutral-900' : 'bg-black text-[#F5F5F7]'
        }`}>
          
          <div className="space-y-6">
            
            {/* Sleek macOS top browser header layout */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-300/20 dark:border-white/5 pb-5 select-none">
              <div className="flex items-center gap-2.5">
                {/* Simulated classic macOS control dots */}
                <div className="flex gap-1.5 mr-3 shrink-0">
                  <span className="w-3 h-3 bg-[#FF5F56] border border-[#E0443E] rounded-full block"></span>
                  <span className="w-3 h-3 bg-[#FFBD2E] border border-[#DEA123] rounded-full block"></span>
                  <span className="w-3 h-3 bg-[#27C93F] border border-[#1AAB29] rounded-full block"></span>
                </div>
                <div className="text-left font-sans">
                  <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white font-sans">
                    CMS Control Panel
                  </h2>
                  <p className="text-xs text-[#8E8E93] dark:text-neutral-400 font-medium">
                    Manage real-time YouTube stream request queues, priority logistics, and cast pipelines.
                  </p>
                </div>
              </div>

              {/* Segmented Controller - macOS music styles */}
              <div className="flex bg-neutral-200/50 dark:bg-neutral-950 p-1 rounded-xl border border-neutral-300/30 dark:border-white/5 shadow-inner">
                <button
                  type="button"
                  onClick={() => handleTabChange('queue')}
                  className={`px-5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeSubTab === 'queue'
                      ? 'bg-white dark:bg-[#323236] text-black dark:text-white shadow font-extrabold'
                      : 'text-neutral-500 hover:text-black dark:text-neutral-400'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5 text-[#FF2D55]" /> Active Queue ({pendingQueue.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('history')}
                  className={`px-5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeSubTab === 'history'
                      ? 'bg-white dark:bg-[#323236] text-black dark:text-white shadow font-extrabold'
                      : 'text-neutral-500 hover:text-black dark:text-neutral-400'
                  }`}
                >
                  <History className="w-3.5 h-3.5" /> Discovery History Log
                </button>
              </div>
            </header>

            {/* Queue statistics readout cards */}
            {activeSubTab === 'queue' && pendingQueue.length > 0 && (
              <div className="grid grid-cols-3 gap-5 select-none text-left">
                <div className={`p-4 rounded-2xl border ${theme === 'light' ? 'bg-white border-neutral-200 shadow-sm' : 'bg-white/[0.015] border-white/5'}`}>
                  <p className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 uppercase tracking-widest font-extrabold">Queue Size</p>
                  <p className="text-2xl font-black mt-1 font-sans text-neutral-900 dark:text-white">{pendingQueue.length} Tracks</p>
                </div>
                <div className={`p-4 rounded-2xl border ${theme === 'light' ? 'bg-white border-neutral-200 shadow-sm' : 'bg-white/[0.015] border-white/5'}`}>
                  <p className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 uppercase tracking-widest font-extrabold">Total Air Playtime</p>
                  <p className="text-2xl font-black mt-1 font-sans text-[#FF2D55]">
                    {formatTime(pendingQueue.reduce((acc, t) => acc + (t.duration || 0), 0))}
                  </p>
                </div>
                <div className={`p-4 rounded-2xl border ${theme === 'light' ? 'bg-white border-neutral-200 shadow-sm' : 'bg-white/[0.015] border-white/5'}`}>
                  <p className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 uppercase tracking-widest font-extrabold">Devices Casting</p>
                  <p className="text-2xl font-black mt-1 font-sans text-emerald-500">
                    {activeDevice && activeDevice.isOnline ? '1 Active' : 'None Paired'}
                  </p>
                </div>
              </div>
            )}

            {/* TAB CONTENT A: ACTIVE QUEUE TABLE LIST */}
            {activeSubTab === 'queue' && (
              <div className={`rounded-2xl border overflow-hidden ${
                theme === 'light' ? 'bg-white border-neutral-200 shadow-sm' : 'bg-[#1C1C1E] border-white/5'
              }`}>
                {pendingQueue.length === 0 ? (
                  <div className="text-center py-24 px-4 space-y-4">
                    <Sparkles className="w-14 h-14 mx-auto text-neutral-300 dark:text-neutral-700 animate-spin [animation-duration:15s]" />
                    <div>
                      <h4 className="text-base font-extrabold text-neutral-900 dark:text-white font-sans">Active request queue is empty</h4>
                      <p className="text-xs text-neutral-400 dark:text-neutral-550 max-w-sm mx-auto mt-1 leading-relaxed">
                        When guests register request titles on the main screen, entries register directly in this desktop table console.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className={`border-b text-[10px] font-mono uppercase font-black tracking-widest ${
                          theme === 'light' ? 'bg-neutral-100 border-neutral-200 text-neutral-500' : 'bg-neutral-950 text-neutral-450 border-white/5'
                        }`}>
                          <th className="py-3 px-4 w-12 text-center">Pos</th>
                          <th className="py-3 px-4">Track Detail Info</th>
                          <th className="py-3 px-4">Artist Creator</th>
                          <th className="py-3 px-4 text-center">Duration</th>
                          <th className="py-3 px-4">Requested Guest</th>
                          <th className="py-3 px-4 text-center">Votes</th>
                          <th className="py-3 px-4 text-right pr-6">Action Commands</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-white/5">
                        {pendingQueue.map((track, idx) => (
                          <tr 
                            key={track.id}
                            className={`group transition-colors ${
                              theme === 'light' ? 'hover:bg-neutral-50' : 'hover:bg-white/[0.015]'
                            }`}
                          >
                            <td className="py-3.5 px-4 font-mono text-center text-xs text-neutral-400 select-none font-bold">
                              {idx + 1}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={track.artworkUrl}
                                  alt={track.title}
                                  referrerPolicy="no-referrer"
                                  className="w-10 h-10 rounded-lg object-cover border border-neutral-200/50 dark:border-white/5 shrink-0 animate-fade-in"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600';
                                  }}
                                />
                                <div className="min-w-0 max-w-[200px] xl:max-w-[250px] text-left">
                                  <p className="text-xs font-extrabold text-neutral-950 dark:text-white truncate font-sans tracking-tight">
                                    {track.title}
                                  </p>
                                  <p className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 truncate mt-0.5">
                                    ID: {track.id.substring(0, 8)}...
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-xs font-semibold text-neutral-600 dark:text-neutral-400 truncate max-w-[140px] text-left">
                              {track.artist}
                            </td>
                            <td className="py-3.5 px-4 text-xs font-mono font-bold text-neutral-500 text-center select-none">
                              {formatTime(track.duration)}
                            </td>
                            <td className="py-3.5 px-4 text-left font-sans">
                              <span className="text-xs px-2.5 py-1 rounded-full bg-pink-500/10 text-[#FF2D55] font-bold">
                                {track.requestedBy}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="text-xs font-mono font-black">{track.votes}</span>
                            </td>
                            <td className="py-3.5 px-4 text-right pr-6">
                              <div className="flex items-center justify-end gap-2.5">
                                
                                {/* Tactile queue up/down indicators */}
                                <div className={`flex items-center gap-1 p-0.5 rounded-lg border shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                                  theme === 'light' ? 'bg-neutral-100 border-neutral-300' : 'bg-black border-neutral-800'
                                }`}>
                                  <button
                                    onClick={() => handleShiftPosition(idx, 'up')}
                                    disabled={idx === 0}
                                    type="button"
                                    className="p-1 rounded text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-20 cursor-pointer"
                                    title="Shift Priority Up"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <span className="w-px h-3 bg-neutral-300 dark:bg-neutral-800 block"></span>
                                  <button
                                    onClick={() => handleShiftPosition(idx, 'down')}
                                    disabled={idx === pendingQueue.length - 1}
                                    type="button"
                                    className="p-1 rounded text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-20 cursor-pointer"
                                    title="Shift Priority Down"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                </div>

                                <button
                                  onClick={() => sendControl('select_track', track.id)}
                                  type="button"
                                  className="py-1.5 px-3 bg-[#007AFF] hover:bg-[#0062CC] text-white font-extrabold text-xs rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Play className="w-3 h-3 fill-current text-white animate-fade-in" /> Play
                                </button>
                                <button
                                  onClick={() => handleDeleteTrack(track.id)}
                                  type="button"
                                  className="p-1.5 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 rounded-xl border border-transparent transition-colors shrink-0 cursor-pointer"
                                  title="Discard from queue"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT B: HISTORICAL HISTORY LOGS TABLE */}
            {activeSubTab === 'history' && (
              <div className={`rounded-xl border overflow-hidden ${
                theme === 'light' ? 'bg-white border-neutral-200 shadow-sm' : 'bg-[#1C1C1E] border-white/5'
              }`}>
                {loadingHistory && historyList.length === 0 ? (
                  <div className="text-center py-24">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#FF2D55]" />
                    <p className="text-xs font-mono font-bold text-neutral-500 dark:text-neutral-400 mt-3 uppercase tracking-wider">Fetching History Logs...</p>
                  </div>
                ) : historyList.length === 0 ? (
                  <div className="text-center py-24 px-4 space-y-4">
                    <Clock className="w-12 h-12 mx-auto text-neutral-300 dark:text-neutral-700" />
                    <div>
                      <h4 className="text-base font-extrabold text-neutral-900 dark:text-white">Playback history dataset empty</h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mt-1 leading-relaxed">
                        Skipped or finished tracks sync from SQL history records and display columns here.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={fetchHistory}
                      className="px-5 py-2.5 rounded-xl border border-neutral-250 dark:border-white/5 text-xs font-bold font-mono tracking-tight cursor-pointer animate-fade-in"
                    >
                      Retrieve Logs
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className={`border-b text-[10px] font-mono uppercase font-black tracking-widest ${
                          theme === 'light' ? 'bg-neutral-100 border-neutral-200 text-neutral-500' : 'bg-neutral-950 text-neutral-450 border-white/5'
                        }`}>
                          <th className="py-3 px-4 w-12 text-center">Row</th>
                          <th className="py-3 px-4">Track Metadata Details</th>
                          <th className="py-3 px-4">Artist</th>
                          <th className="py-3 px-4 text-center">Length</th>
                          <th className="py-3 px-4">Original Guest</th>
                          <th className="py-3 px-4">Playback Log Status</th>
                          <th className="py-3 px-4 text-right pr-6">Action Replays</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-white/5">
                        {historyList.map((track, idx) => {
                          const playedTimeStr = (track as any).playedAt 
                            ? new Date((track as any).playedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : null;

                          return (
                            <tr 
                              key={track.id}
                              className={`transition-colors ${
                                theme === 'light' ? 'hover:bg-neutral-50' : 'hover:bg-white/[0.015]'
                              }`}
                            >
                              <td className="py-3.5 px-4 font-mono text-center text-xs text-neutral-400 select-none">
                                {idx + 1}
                              </td>
                              <td className="py-3.5 px-4 animate-fade-in">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={track.artworkUrl}
                                    alt={track.title}
                                    referrerPolicy="no-referrer"
                                    className="w-9 h-9 rounded-lg object-cover border border-neutral-200/50 dark:border-white/5 shrink-0"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600';
                                    }}
                                  />
                                  <div className="min-w-0 max-w-[200px] xl:max-w-[250px] text-left animate-fade-in">
                                    <p className="text-xs font-extrabold text-neutral-900 dark:text-white truncate font-sans tracking-tight">
                                      {track.title}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-xs font-semibold text-neutral-500 dark:text-neutral-400 truncate max-w-[140px] text-left">
                                {track.artist}
                              </td>
                              <td className="py-3.5 px-4 text-xs font-mono font-bold text-neutral-400 text-center select-none">
                                {formatTime(track.duration)}
                              </td>
                              <td className="py-3.5 px-4 text-left">
                                <span className="text-xs px-2.5 py-1 rounded-full bg-pink-500/10 text-[#FF2D55] font-bold font-mono">
                                  {track.requestedBy}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-left">
                                {playedTimeStr ? (
                                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full w-fit">
                                    <Clock className="w-2.5 h-2.5" /> Played {playedTimeStr}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-mono text-neutral-400">Streamed Logged</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right pr-6">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (socket) {
                                      socket.emit('add_request', {
                                        title: track.title,
                                        artist: track.artist,
                                        url: track.url,
                                        youtubeId: track.youtubeId,
                                        artworkUrl: track.artworkUrl,
                                        duration: track.duration,
                                        requestedBy: `Replay (${djName})`,
                                        originalName: track.originalName,
                                        originalArtist: track.originalArtist,
                                        originalCover: track.originalCover,
                                        originalLabel: track.originalLabel
                                      });
                                      onAlert(`Requeued "${track.title}" to play list.`, 'success');
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 py-1.5 px-3 rounded-xl border border-neutral-300 dark:border-white/10 text-xs font-extrabold hover:border-[#FF2D55] hover:text-[#FF2D55] transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5 text-[#FF2D55]" /> Requeue track
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Table index footer */}
          <footer className="mt-8 pt-4 border-t border-neutral-300/20 dark:border-white/5 text-center flex items-center justify-between text-[11px] font-mono text-[#8E8E93] dark:text-neutral-550 select-none">
            <span className="uppercase"> Sonic Stream Music Client Core Node</span>
            <span>CMS VERSION 6.4 • LIVE SYNC ACTIVE</span>
          </footer>

        </main>

      </div>

    </div>
  );
}
