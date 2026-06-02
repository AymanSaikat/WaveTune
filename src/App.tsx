import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Track, PlaybackState, PairedDevice } from './types';
import { getBackendUrl, apiFetch } from './utils';
import PublicView from './components/PublicView';
import AdminView from './components/AdminView';
import PlayerView from './components/PlayerView';
import Settings from './components/Settings';
import AccountView from './components/AccountView';
import DashboardView from './components/DashboardView';
import WaveTuneLogo from './components/WaveTuneLogo';
import {
  Music,
  Settings as SettingsIcon,
  AlertTriangle,
  Sparkles,
  Lock,
  Key,
  Loader2,
  LogOut,
  Smartphone,
  Terminal,
  Laptop,
  ChevronLeft,
  ArrowLeft,
  Sun,
  Moon,
  User,
  LayoutDashboard
} from 'lucide-react';

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    currentTrackId: null,
    status: 'stopped',
    progress: 0,
    volume: 75,
    activeDeviceId: null,
  });
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  
  // Navigation View: 'request' (Public song requests page) or 'cms' (Administrative operations console & settings)
  const [viewMode, setViewMode] = useState<'request' | 'cms'>('request');

  // Sub-tabs exclusive to logged-in administrator inside the CMS
  const [cmsTab, setCmsTab] = useState<'dashboard' | 'console' | 'output' | 'settings' | 'account'>('dashboard');

  // Master Host details
  const [djName, setDjName] = useState(() => localStorage.getItem('sonicstream_dj_name') || 'Ayman Saikat');
  const [roomDesc, setRoomDesc] = useState('WaveTune Live Audio System - Broadcast Terminal');
  const [activeStreamLimit, setActiveStreamLimit] = useState('unlimited');

  // Backend connection url for GitHub Pages compatibility
  const [backendUrl, setBackendUrlState] = useState(() => getBackendUrl());

  // Broadcasting Hub Link states
  const [broadcastingHubLink, setBroadcastingHubLink] = useState(() => localStorage.getItem('sonicstream_broadcasting_hub_link') || 'https://github.com/AymanSaikat');
  const [broadcastingHubLinkInput, setBroadcastingHubLinkInput] = useState(() => localStorage.getItem('sonicstream_broadcasting_hub_link') || 'https://github.com/AymanSaikat');

  // Unified theme mode
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('sonicstream_admin_theme') as 'dark' | 'light') || 'dark';
  });

  // Admin authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('sonicstream_admin_token') === 'sonicstream-admin-authenticated-token';
  });

  // Passcode login states
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Flash Alert System
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const alertTimeoutRef = useRef<number | null>(null);

  const showAlert = (message: string, type: 'success' | 'error') => {
    if (alertTimeoutRef.current) {
      window.clearTimeout(alertTimeoutRef.current);
    }
    setAlert({ message, type });
    alertTimeoutRef.current = window.setTimeout(() => {
      setAlert(null);
    }, 4000);
  };

  const handleThemeChange = (nextTheme: 'dark' | 'light') => {
    setTheme(nextTheme);
    localStorage.setItem('sonicstream_admin_theme', nextTheme);
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    // Connect to WebSocket pointing dynamically to the configured backendURL
    const socketInstance = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      console.log('Real-time connection pipeline established with socket ID:', socketInstance.id);
    });

    socketInstance.on('queue_update', (updatedQueue: Track[]) => {
      setQueue(updatedQueue);
    });

    socketInstance.on('playback_state_update', (updatedState: PlaybackState) => {
      setPlaybackState(updatedState);
    });

    socketInstance.on('devices_update', (updatedDevices: PairedDevice[]) => {
      setDevices(updatedDevices);
    });

    socketInstance.on('disconnect', () => {
      console.warn('Real-time synchronization socket disconnected.');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Handle Admin Passcode Login
  const handleAdminLogin = async (e: React.FormEvent) => {
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
        localStorage.setItem('sonicstream_broadcasting_hub_link', broadcastingHubLinkInput);
        setBroadcastingHubLink(broadcastingHubLinkInput);
        setIsAuthenticated(true);
        showAlert('Admin CMS authenticated and unlocked.', 'success');
        setPassword('');
      } else {
        showAlert(data.error || 'Invalid administrator passcode.', 'error');
      }
    } catch (err) {
      showAlert('Failed to connect to authentication server.', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Admin Log out
  const handleAdminLogout = () => {
    localStorage.removeItem('sonicstream_admin_token');
    setIsAuthenticated(false);
    setPassword('');
    setViewMode('request');
    showAlert('Logged out. Administrative lock engaged.', 'success');
  };

  return (
    <div className={`min-h-screen selection:bg-pink-500/30 selection:text-neutral-900 dark:selection:text-white antialiased transition-colors duration-300 ${
      theme === 'light'
        ? 'bg-[#F2F2F7] text-neutral-900 pb-32'
        : 'bg-[#050505] text-[#F5F5F7] pb-32'
    }`}>
      
      {/* 1. Global Alert Notification banner */}
      {alert && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 animate-slide-down ${
            alert.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
              : 'bg-red-500/10 border-red-500/25 text-red-300'
          }`}
        >
          {alert.type === 'success' ? (
            <Sparkles className="w-4 h-4 text-emerald-400 fill-emerald-400/10 animate-pulse" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400" />
          )}
          <span className="text-xs font-mono font-medium">{alert.message}</span>
        </div>
      )}

      {/* 2. Public Facing Header (for guest song requests mode) */}
      {viewMode === 'request' && (
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/60 backdrop-blur-md border-b border-neutral-200/50 dark:border-white/5 text-neutral-900 dark:text-[#F5F5F7]">
          <div className="max-w-6xl mx-auto px-4 h-16 md:h-20 flex items-center justify-between">
            
            {/* Title / Logo */}
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <WaveTuneLogo size="sm" />
              <div className="text-left truncate">
                <span className="text-sm md:text-base font-black tracking-tight font-sans text-neutral-900 dark:text-[#F5F5F7]">
                  WaveTune
                </span>
                <span className="block text-[7px] md:text-[8px] font-mono text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mt-0.5 truncate bg-neutral-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
                  Guest Request Portal
                </span>
              </div>
            </div>

            {/* Actions group */}
            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              {/* Prominent Theme Toggle */}
              <button
                type="button"
                onClick={() => handleThemeChange(theme === 'dark' ? 'light' : 'dark')}
                className="p-2.5 rounded-full border border-neutral-300 dark:border-white/10 bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-neutral-800 dark:text-yellow-400 transition-all cursor-pointer duration-200 active:scale-95 shadow-sm flex items-center justify-center"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-500 fill-amber-500/10" />
                ) : (
                  <Moon className="w-4 h-4 text-neutral-800 fill-neutral-800/10" />
                )}
              </button>

              <button
                onClick={() => setViewMode('cms')}
                className="flex items-center gap-1.5 px-3 md:px-4 py-2.5 shadow-md rounded-full text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all cursor-pointer active:scale-95"
              >
                <Lock className="w-3.5 h-3.5 fill-current shrink-0" />
                <span className="hidden sm:inline">CMS Login</span>
                <span className="sm:hidden">CMS</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* 3. Administrative Custom Control Header (rendered ONLY when logged in) */}
      {viewMode === 'cms' && isAuthenticated && (
        <>
          {/* Desktop CMS Header */}
          <header className="hidden md:block sticky top-0 z-40 bg-white/80 dark:bg-[#0c0d10]/90 backdrop-blur-md border-b border-neutral-200/50 dark:border-white/5 shadow-md dark:shadow-2xl">
            <div className="max-w-6xl mx-auto px-4 h-20 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0">
              
              {/* Logo details */}
              <div className="flex items-center gap-2.5">
                <WaveTuneLogo size="sm" />
                <div className="text-left">
                  <span className="text-sm font-extrabold tracking-tight text-neutral-900 dark:text-[#F5F5F7] flex items-center gap-1.5 font-sans">
                    WaveTune CMS
                  </span>
                </div>
              </div>

              {/* Administrator core sub-tabs */}
              <nav className="flex bg-neutral-900 border border-white/5 rounded-full p-1 w-auto self-center md:self-auto">
                <button
                  type="button"
                  onClick={() => setCmsTab('dashboard')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    cmsTab === 'dashboard'
                      ? 'bg-white text-black shadow-lg shadow-white/5'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => setCmsTab('console')}
                  className={`flex items-center gap-1.5 px-4.5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    cmsTab === 'console'
                      ? 'bg-white text-black shadow-lg shadow-white/5'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" /> DJ Console
                </button>
                <button
                  type="button"
                  onClick={() => setCmsTab('output')}
                  className={`flex-1 flex items-center gap-1.5 px-4.5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    cmsTab === 'output'
                      ? 'bg-white text-black shadow-lg shadow-white/5'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" /> Output Player
                </button>
                <button
                  type="button"
                  onClick={() => setCmsTab('settings')}
                  className={`flex-1 flex items-center gap-1.5 px-4.5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    cmsTab === 'settings'
                      ? 'bg-white text-black shadow-lg shadow-white/5'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <SettingsIcon className="w-3.5 h-3.5" /> Settings
                </button>
                <button
                  type="button"
                  onClick={() => setCmsTab('account')}
                  className={`flex-1 flex items-center gap-1.5 px-4.5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    cmsTab === 'account'
                      ? 'bg-white text-black shadow-lg shadow-white/5'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <User className="w-3.5 h-3.5" /> Account
                </button>
              </nav>

              {/* Action buttons */}
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('request');
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#000000]/05 hover:bg-[#000000]/08 dark:bg-white/5 dark:hover:bg-white/10 text-neutral-800 dark:text-[#F5F5F7] border border-neutral-250 dark:border-white/5 rounded-lg text-xs font-medium transition-all active:scale-[0.98] cursor-pointer"
                  title="View request site with active admin session"
                >
                  <ArrowLeft className="w-3.5 h-3.5 stroke-[2]" />
                  <span>Back to Request Page</span>
                </button>
              </div>
            </div>
          </header>
 
          {/* Mobile CMS Header (styled like standard iOS Header) */}
          <header className={`md:hidden sticky top-0 z-40 border-b backdrop-blur-xl flex items-center justify-between px-4 h-12 select-none ${
            theme === 'light'
              ? 'bg-[#F2F2F7]/95 border-[#C6C6C8]/30'
              : 'bg-black/90 border-[#38383A]/50'
          }`}>
            {/* Top Left: iOS-style Back Button */}
            <button
              type="button"
              onClick={() => {
                setViewMode('request');
              }}
              className="flex items-center gap-1 text-[#007AFF] dark:text-[#0A84FF] hover:opacity-75 active:scale-95 transition-all font-sans text-[17px] cursor-pointer"
            >
              <ChevronLeft className="w-6 h-6 -ml-1 stroke-[2.5]" />
              <span>Back</span>
            </button>
 
            {/* Center Title */}
            <div className="text-center">
              <h1 className={`text-[13px] uppercase tracking-widest font-mono font-bold ${theme === 'light' ? 'text-neutral-900' : 'text-white'}`}>
                {cmsTab === 'dashboard' ? 'Overview' : cmsTab === 'console' ? 'DJ Console' : cmsTab === 'output' ? 'Output Player' : cmsTab === 'settings' ? 'Settings' : 'Account'}
              </h1>
            </div>
 
            {/* Top Right: Balanced empty element for precise centering */}
            <div className="w-12 h-6" />
          </header>
        </>
      )}

      {/* 4. Core View Contents Router */}
      <main className={viewMode === 'cms' && isAuthenticated ? 'w-full md:max-w-6xl md:mx-auto md:px-4 md:mt-8' : 'max-w-6xl mx-auto px-4 mt-8'}>
        
        {/* VIEW 1: Public Music Request page */}
        {viewMode === 'request' && (
          <PublicView
            socket={socket}
            queue={queue}
            playbackState={playbackState}
            onAlert={showAlert}
            theme={theme}
          />
        )}

        {/* VIEW 2: CMS Terminal (Locked Passcode check or Tab Routing system) */}
        {viewMode === 'cms' && (
          !isAuthenticated ? (
            /* Elegant Security Login Form Gate */
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-fade-in relative z-10 text-neutral-900 dark:text-white">
              <div className="absolute inset-0 bg-neutral-200 dark:bg-white/5 blur-[120px] rounded-full scale-75 pointer-events-none" />
              <div className="bg-white dark:bg-[#0b0c0e] border border-neutral-200 dark:border-white/10 p-8 max-w-md w-full relative z-20 shadow-2xl rounded-3xl">
                <div className="text-center mb-8">
                  <div className="w-14 h-14 bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-neutral-900 dark:text-white">
                    <Lock className="w-6 h-6 text-pink-500 animate-pulse" />
                  </div>
                  <h2 className="text-2xl font-bold font-sans text-neutral-900 dark:text-white tracking-tight">System Login</h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 font-sans leading-relaxed">
                    Enter the administrator passcode to access the live deck console, cast player, and CMS configurations.
                  </p>
                </div>

                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div>
                    <label className="block text-left text-xs font-semibold text-neutral-400 dark:text-white/40 uppercase tracking-widest mb-2">
                      Passcode
                    </label>
                    <div className="relative">
                      <Key className="absolute left-4 top-3.5 w-4 h-4 text-neutral-400 dark:text-white/20" />
                      <input
                        type="password"
                        placeholder="••••••••"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl py-3 pl-11 pr-4 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-white/20 text-sm focus:outline-none focus:border-purple-500 transition-all font-sans text-left"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-left text-xs font-semibold text-neutral-400 dark:text-white/40 uppercase tracking-widest mb-2">
                      Broadcasting Hub Link / Broadcaster Name
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. https://github.com/AymanSaikat"
                        required
                        value={broadcastingHubLinkInput}
                        onChange={(e) => setBroadcastingHubLinkInput(e.target.value)}
                        className="w-full bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl py-3 px-4 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-white/20 text-sm focus:outline-none focus:border-purple-500 transition-all font-sans text-left"
                      />
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-1.5 text-left font-mono">
                      * Asked on login to dynamically set your custom broadcasting hub location.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full py-3 bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-lg mt-6"
                  >
                    {isLoggingIn ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white dark:text-black" /> Authenticating...
                      </>
                    ) : (
                      <>
                        Unlock CMS Console
                      </>
                    )}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => setViewMode('request')}
                  className="mt-6 w-full py-3 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5 rounded-2xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-neutral-800 dark:hover:text-white transition-all flex items-center justify-center gap-2.5 mx-auto active:scale-[0.98] cursor-pointer shadow-sm duration-150"
                >
                  <ArrowLeft className="w-4 h-4 stroke-[2]" /> 
                  <span>Return to Song Requests</span>
                </button>

                <div className="mt-8 pt-4 border-t border-neutral-200 dark:border-white/5 text-[10px] font-mono text-neutral-400 dark:text-neutral-500 text-center uppercase tracking-wider">
                  Protected Admin Terminal Gate
                </div>
              </div>
            </div>
          ) : (
             /* Logged in Administrative Dashboard tabs */
            <div className="space-y-8 animate-fade-in text-left">
              
              {cmsTab === 'dashboard' && (
                <DashboardView
                  socket={socket}
                  queue={queue}
                  playbackState={playbackState}
                  devices={devices}
                  onAlert={showAlert}
                  theme={theme}
                  djName={djName}
                  roomDesc={roomDesc}
                  activeStreamLimit={activeStreamLimit}
                  onNavigateTab={(tab) => setCmsTab(tab)}
                />
              )}

              {cmsTab === 'console' && (
                <AdminView
                  socket={socket}
                  queue={queue}
                  playbackState={playbackState}
                  devices={devices}
                  onAlert={showAlert}
                  onLogout={handleAdminLogout}
                  theme={theme}
                  setTheme={handleThemeChange}
                />
              )}

              {cmsTab === 'output' && (
                <div className="space-y-6">
                  <div className="p-4 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-2xl text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 font-sans">
                    <div>
                      <p className="font-semibold">Live broadcast stream player active.</p>
                      <p className="opacity-80">This panel executes the YouTube Media Visualizer directly in your control pane. Connect external displays if casting.</p>
                    </div>
                    <button 
                      onClick={() => {
                        window.open(window.location.origin, '_blank');
                      }}
                      className="px-3.5 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap"
                    >
                      Open TV Cast Tab
                    </button>
                  </div>
                  <PlayerView
                    socket={socket}
                    queue={queue}
                    playbackState={playbackState}
                    onAlert={showAlert}
                    theme={theme}
                  />
                </div>
              )}

              {cmsTab === 'settings' && (
                <Settings
                  socket={socket}
                  queue={queue}
                  playbackState={playbackState}
                  onAlert={showAlert}
                  theme={theme}
                  activeStreamLimit={activeStreamLimit}
                  setActiveStreamLimit={setActiveStreamLimit}
                  backendUrl={backendUrl}
                  setBackendUrl={(newUrl) => {
                    localStorage.setItem('sonicstream_backend_url', newUrl);
                    setBackendUrlState(newUrl);
                    showAlert('Backend URL updated! Refresh to restream on this connection.', 'success');
                  }}
                />
              )}

              {cmsTab === 'account' && (
                <AccountView
                  theme={theme}
                  setTheme={handleThemeChange}
                  djName={djName}
                  setDjName={(name) => {
                    setDjName(name);
                    localStorage.setItem('sonicstream_dj_name', name);
                  }}
                  roomDesc={roomDesc}
                  setRoomDesc={setRoomDesc}
                  activeStreamLimit={activeStreamLimit}
                  setActiveStreamLimit={setActiveStreamLimit}
                  onLogout={handleAdminLogout}
                  onAlert={showAlert}
                  queue={queue}
                  broadcastingHubLink={broadcastingHubLink}
                  setBroadcastingHubLink={setBroadcastingHubLink}
                />
              )}

            </div>
          )
        )}
      </main>

      {/* Bottom Option Island (Tab bar for Mobile) */}
      {viewMode === 'cms' && isAuthenticated && (
        <div className="md:hidden fixed bottom-4 left-4 right-4 z-50 pb-safe">
          <div className={`backdrop-blur-xl border rounded-[22px] flex items-center justify-around py-2 px-1 shadow-[0_12px_36px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.6)] ${
            theme === 'light'
              ? 'bg-white/95 border-[#C6C6C8]/40 text-neutral-800'
              : 'bg-[#1C1C1E]/95 border-white/10 text-[#F5F5F7]'
          }`}>
            <button
              type="button"
              onClick={() => {
                setCmsTab('dashboard');
              }}
              className={`flex-1 py-1.5 flex flex-col items-center justify-center transition-all cursor-pointer ${
                cmsTab === 'dashboard'
                  ? 'text-[#FF2D55] scale-105 font-extrabold'
                  : 'text-neutral-400 dark:text-[#8E8E93]'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[9px] mt-0.5 tracking-tight font-sans font-medium">Overview</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCmsTab('console');
              }}
              className={`flex-1 py-1.5 flex flex-col items-center justify-center transition-all cursor-pointer ${
                cmsTab === 'console'
                  ? 'text-[#FF2D55] scale-105 font-extrabold'
                  : 'text-neutral-400 dark:text-[#8E8E93]'
              }`}
            >
              <Terminal className="w-5 h-5" />
              <span className="text-[9px] mt-0.5 tracking-tight font-sans font-medium">Console</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCmsTab('output');
              }}
              className={`flex-1 py-1.5 flex flex-col items-center justify-center transition-all cursor-pointer ${
                cmsTab === 'output'
                  ? 'text-[#FF2D55] scale-105 font-extrabold'
                  : 'text-neutral-400 dark:text-[#8E8E93]'
              }`}
            >
              <Smartphone className="w-5 h-5" />
              <span className="text-[9px] mt-0.5 tracking-tight font-sans font-medium">Output</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCmsTab('settings');
              }}
              className={`flex-1 py-1.5 flex flex-col items-center justify-center transition-all cursor-pointer ${
                cmsTab === 'settings'
                  ? 'text-[#FF2D55] scale-105 font-extrabold'
                  : 'text-neutral-400 dark:text-[#8E8E93]'
              }`}
            >
              <SettingsIcon className="w-5 h-5" />
              <span className="text-[9px] mt-0.5 tracking-tight font-sans font-medium">Settings</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCmsTab('account');
              }}
              className={`flex-1 py-1.5 flex flex-col items-center justify-center transition-all cursor-pointer ${
                cmsTab === 'account'
                  ? 'text-[#FF2D55] scale-105 font-extrabold'
                  : 'text-neutral-400 dark:text-[#8E8E93]'
              }`}
            >
              <User className="w-5 h-5" />
              <span className="text-[9px] mt-0.5 tracking-tight font-sans font-medium">Account</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
