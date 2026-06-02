import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Socket } from 'socket.io-client';
import { Track, PlaybackState, PairedDevice } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  ListMusic,
  Radio,
  Tv,
  ExternalLink,
  Laptop,
  CheckCircle,
  Play,
  Pause,
  SkipForward,
  Server,
  Zap,
  Trash2,
  Lock,
  Moon,
  Sun,
  User,
  Activity
} from 'lucide-react';
import GlassCard from './GlassCard';

interface DashboardViewProps {
  socket: Socket | null;
  queue: Track[];
  playbackState: PlaybackState;
  devices: PairedDevice[];
  onAlert: (msg: string, type: 'success' | 'error') => void;
  theme: 'light' | 'dark';
  djName: string;
  roomDesc: string;
  activeStreamLimit: string;
  onNavigateTab: (tab: 'console' | 'output' | 'settings' | 'account') => void;
}

export default function DashboardView({
  socket,
  queue,
  playbackState,
  devices,
  onAlert,
  theme,
  djName,
  roomDesc,
  activeStreamLimit,
  onNavigateTab
}: DashboardViewProps) {
  // Calculated metrics
  const totalSongs = queue.length;
  const queuedSongs = queue.filter((t) => t.status === 'queued').length;
  const playedSongs = queue.filter((t) => t.status === 'played').length;
  const onlineDevicesCount = devices.filter((d) => d.isOnline).length;

  const artistCounts: { [artist: string]: number } = {};
  queue.forEach((track) => {
    const artist = track.artist ? track.artist.trim() : 'Unknown';
    artistCounts[artist] = (artistCounts[artist] || 0) + 1;
  });

  const chartData = Object.entries(artistCounts)
    .map(([name, count]) => ({ name, Requests: count }))
    .sort((a, b) => b.Requests - a.Requests)
    .slice(0, 5);
  
  // Find current song
  const currentlyPlaying = queue.find(
    (t) => t.id === playbackState.currentTrackId && t.status === 'playing'
  );

  // Trigger quick play/pause/skip control
  const handleQuickControl = (action: 'play' | 'pause' | 'skip') => {
    if (!socket) {
      onAlert('Real-time synchronization disconnected.', 'error');
      return;
    }
    socket.emit('playback_control', { action });
    onAlert(`Quick Command dispatched: ${action.toUpperCase()}`, 'success');
  };

  // Clear current active queue
  const handleClearQueue = () => {
    if (!socket) return;
    if (window.confirm('Are you sure you want to purge the live request queue? This cannot be undone.')) {
      socket.emit('clear_queue');
      onAlert('Live guest request queue flushed successfully.', 'success');
    }
  };

  // Minimal flat hover options
  const cardHoverProps = {
    whileHover: { scale: 1 },
    whileTap: { scale: 1 },
    transition: { duration: 0.1 }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 px-4 md:px-0">
      {/* 1. Header Hero section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-dashed border-neutral-500/10 pb-6">
        <div>
          <h2 className={`text-2xl font-black font-sans tracking-tight ${theme === 'light' ? 'text-neutral-900' : 'text-white'}`}>
            WaveTune Management Station
          </h2>
          <p className={`text-xs mt-1 font-sans ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
            Welcome back, <span className="font-bold text-pink-500">{djName}</span>. Your broadcast server is live and monitoring incoming guest song requests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm animate-pulse">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
            <span>SOCKET PIPELINE ACTIVE</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-sm">
            <span>UNIFY-V2 STREAMING</span>
          </div>
        </div>
      </div>

      {/* 2. Core Operational Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Queue Count */}
        <motion.div
          {...cardHoverProps}
          onClick={() => onNavigateTab('console')}
          className={`p-5 rounded-3xl border text-left cursor-pointer transition-all ${
            theme === 'light' ? 'bg-white border-neutral-200' : 'bg-zinc-900/40 border-white/5'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">Total Requested</span>
            <div className="p-1.5 rounded-xl bg-pink-500/10 text-pink-500">
              <ListMusic className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className={`text-2xl font-extrabold font-sans ${theme === 'light' ? 'text-neutral-950' : 'text-white'}`}>
              {totalSongs}
            </span>
            <span className="block text-[10px] text-neutral-400 mt-0.5">
              {queuedSongs} pending • {playedSongs} played
            </span>
          </div>
        </motion.div>

        {/* Stat 2: Active Listeners */}
        <motion.div
          {...cardHoverProps}
          onClick={() => onNavigateTab('console')}
          className={`p-5 rounded-3xl border text-left cursor-pointer transition-all ${
            theme === 'light' ? 'bg-white border-neutral-200' : 'bg-zinc-900/40 border-white/5'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">Pairings Live</span>
            <div className="p-1.5 rounded-xl bg-purple-500/10 text-purple-500">
              <Laptop className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className={`text-2xl font-extrabold font-sans ${theme === 'light' ? 'text-neutral-950' : 'text-white'}`}>
              {onlineDevicesCount}
            </span>
            <span className="block text-[10px] text-neutral-400 mt-0.5">
              {devices.length} registered player devices
            </span>
          </div>
        </motion.div>

        {/* Stat 3: Playback Status */}
        <motion.div
          {...cardHoverProps}
          onClick={() => onNavigateTab('console')}
          className={`p-5 rounded-3xl border text-left cursor-pointer transition-all ${
            theme === 'light' ? 'bg-white border-neutral-200' : 'bg-zinc-900/40 border-white/5'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">Playback state</span>
            <div className={`p-1.5 rounded-xl ${playbackState.status === 'playing' ? 'bg-emerald-500/10 text-emerald-400 animate-pulse' : 'bg-amber-500/10 text-amber-500'}`}>
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className={`text-xl font-extrabold font-sans uppercase tracking-tight ${theme === 'light' ? 'text-neutral-950' : 'text-white'}`}>
              {playbackState.status}
            </span>
            <span className="block text-[10px] text-neutral-400 mt-0.5 truncate">
              {currentlyPlaying ? currentlyPlaying.title : 'No track active'}
            </span>
          </div>
        </motion.div>

        {/* Stat 4: Stream limitations */}
        <motion.div
          {...cardHoverProps}
          onClick={() => onNavigateTab('settings')}
          className={`p-5 rounded-3xl border text-left cursor-pointer transition-all ${
            theme === 'light' ? 'bg-white border-neutral-200' : 'bg-zinc-900/40 border-white/5'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">Queue safety limit</span>
            <div className="p-1.5 rounded-xl bg-blue-500/10 text-blue-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className={`text-xl font-extrabold font-sans ${theme === 'light' ? 'text-neutral-950' : 'text-white'}`}>
              {activeStreamLimit === 'unlimited' ? 'Unlimited' : `${activeStreamLimit} Songs`}
            </span>
            <span className="block text-[10px] text-neutral-400 mt-0.5">
              Host auto-throttling guest requests
            </span>
          </div>
        </motion.div>
      </div>

      {/* 3. Main Dashboard Layout Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Currently Playing & Action Deck Card */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Deck Action Card */}
          <GlassCard theme={theme} className="p-6">
            <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 mb-4 ${
              theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'
            }`}>
              <Radio className="w-4 h-4 text-pink-500" /> Deck Quick-Controls
            </h3>

            {currentlyPlaying ? (
              <div className="flex flex-col md:flex-row items-center gap-6 p-4 rounded-2xl bg-neutral-100/40 dark:bg-black/25 border border-neutral-200/50 dark:border-white/5 text-left w-full">
                <img
                  src={currentlyPlaying.artworkUrl || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=300"}
                  alt={currentlyPlaying.title}
                  className="w-16 h-16 rounded-xl object-cover shadow-md shrink-0 border border-neutral-300 dark:border-white/10"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] uppercase font-bold text-[#FF2D55] tracking-widest block mb-0.5">NOW BROADCASTING</span>
                  <h4 className={`text-base font-extrabold truncate ${theme === 'light' ? 'text-neutral-900' : 'text-white'}`}>
                    {currentlyPlaying.title}
                  </h4>
                  <p className="text-xs text-neutral-400 font-medium truncate mt-0.5">
                    {currentlyPlaying.artist} • Requested by <span className="font-bold text-neutral-300">{currentlyPlaying.requestedBy}</span>
                  </p>
                </div>
                
                {/* Controller Action Row */}
                <div className="flex items-center gap-2 shrink-0">
                  {playbackState.status === 'playing' ? (
                    <button
                      onClick={() => handleQuickControl('pause')}
                      className="p-3 bg-white text-black hover:bg-neutral-200 rounded-full shadow-lg cursor-pointer transition-all active:scale-95"
                      title="Pause Cast Output"
                    >
                      <Pause className="w-4 h-4 fill-current text-neutral-900" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleQuickControl('play')}
                      className="p-3 bg-[#FF2D55] text-white hover:bg-pink-650 rounded-full shadow-lg cursor-pointer transition-all active:scale-95 animate-pulse"
                      title="Play Cast Output"
                    >
                      <Play className="w-4 h-4 fill-current text-white" />
                    </button>
                  )}
                  <button
                    onClick={() => handleQuickControl('skip')}
                    className="p-3 bg-neutral-200/60 dark:bg-white/10 text-neutral-800 dark:text-white hover:bg-white/20 rounded-full cursor-pointer transition-all active:scale-95"
                    title="Skip to Next Track"
                  >
                    <SkipForward className="w-4 h-4 fill-current" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center rounded-2xl bg-neutral-100/40 dark:bg-black/25 border border-dashed border-neutral-300 dark:border-white/5">
                <span className="block text-xs text-neutral-400 font-sans">
                  The audio deck is currently quiet. Add tracks in Console or wait for guest submissions.
                </span>
                <button
                  onClick={() => onNavigateTab('console')}
                  className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-pink-500 hover:bg-pink-650 shadow-md cursor-pointer transition-all"
                >
                  <ListMusic className="w-3.5 h-3.5" /> Navigate to DJ Console
                </button>
              </div>
            )}

            {/* Platform Quick Tasks Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <button
                onClick={() => onNavigateTab('output')}
                className="p-4 rounded-xl border border-dashed border-neutral-500/15 hover:border-pink-500/40 text-left cursor-pointer transition-all group hover:bg-pink-500/[0.02]"
              >
                <Tv className="w-5 h-5 text-indigo-400 mb-2 group-hover:scale-105 transition-transform" />
                <span className="block text-xs font-bold font-sans">Go to Cast TV Player</span>
                <span className="block text-[10px] text-neutral-400 mt-1">Activate high-res audio bridge.</span>
              </button>

              <button
                onClick={() => onNavigateTab('account')}
                className="p-4 rounded-xl border border-dashed border-neutral-500/15 hover:border-pink-500/40 text-left cursor-pointer transition-all group hover:bg-pink-500/[0.02]"
              >
                <User className="w-5 h-5 text-[#FF2D55] mb-2 group-hover:scale-105 transition-transform" />
                <span className="block text-xs font-bold font-sans">Modify Account</span>
                <span className="block text-[10px] text-neutral-400 mt-1">Change display names & passcode.</span>
              </button>

              <button
                onClick={handleClearQueue}
                className="p-4 rounded-xl border border-dashed border-neutral-500/15 hover:border-red-500/45 text-left cursor-pointer transition-all group hover:bg-red-500/[0.02]"
              >
                <Trash2 className="w-5 h-5 text-red-400 mb-2 group-hover:scale-105 transition-transform" />
                <span className="block text-xs font-bold text-red-500 dark:text-red-400">Purge Active Queue</span>
                <span className="block text-[10px] text-neutral-400 mt-1">Flush queue and start over.</span>
              </button>
            </div>
          </GlassCard>

          {/* Queue Demand Analytics (Top Artists Recharts) */}
          <GlassCard theme={theme} className="p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${
                theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'
              }`}>
                <Activity className="w-4 h-4 text-pink-500" /> Queue Demand Analytics (Top Artists)
              </h3>
              <span className="text-[10px] bg-pink-500/10 text-pink-500 border border-pink-500/20 px-2.5 py-0.5 rounded-full font-mono font-bold">
                Live Data
              </span>
            </div>

            {queue.length === 0 ? (
              <div className="text-center py-12 text-neutral-500 space-y-2">
                <p className="font-sans text-sm">No analytics available yet.</p>
                <p className="font-mono text-xs text-neutral-400 dark:text-neutral-600">The song queue is empty. Submit guest requests to populate charts!</p>
              </div>
            ) : (
              <div className="w-full h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      tickLine={false} 
                      axisLine={false}
                      width={100}
                      tick={{ fill: theme === 'light' ? '#404040' : '#a3a3a3', fontSize: 10, fontFamily: 'Inter, sans-serif' }} 
                    />
                    <Tooltip 
                      cursor={{ fill: theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)' }}
                      contentStyle={{
                        background: theme === 'light' ? '#ffffff' : '#18181b',
                        border: theme === 'light' ? '1px solid #e5e5e5' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontFamily: 'monospace'
                      }}
                    />
                    <Bar dataKey="Requests" radius={[0, 8, 8, 0]}>
                      {chartData.map((entry, index) => {
                        const colors = ['#EC4899', '#D946EF', '#A855F7', '#8B5CF6', '#6366F1'];
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlassCard>

          {/* System Telemetry & Connection Metrics Table */}
          <GlassCard theme={theme} className="p-6">
            <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 mb-4 ${
              theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'
            }`}>
              <Server className="w-4 h-4 text-purple-400" /> System Telemetry & Signal Strength
            </h3>

            <div className="space-y-3 font-mono text-[11px]">
              <div className="flex justify-between items-center py-2 border-b border-neutral-500/10">
                <span className="text-neutral-500 font-bold">CORE STREAM NODE</span>
                <span className="text-emerald-400 font-black">● LIVE / ONLINE</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-500/10">
                <span className="text-neutral-500 font-bold">SOCKET TRANSMISSION DATA</span>
                <span className="font-semibold text-neutral-300">WebSocket Engine Engine.IO v4</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-neutral-500/10">
                <span className="text-neutral-500 font-bold">STATE STORE LATENCY</span>
                <span className="text-pink-500 font-extrabold">Instant Dev Container Hot Storage</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-neutral-500 font-bold">AUTHENTICATION STATE</span>
                <span className="text-purple-400 font-bold">Encrypted Token Signature Active</span>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Right Column: Audio System Details Panel */}
        <div className="space-y-6">
          <GlassCard theme={theme} className="p-6 text-left">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-pink-500" />
              <h3 className={`text-sm font-bold uppercase tracking-wider ${
                theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'
              }`}>
                Broadcaster Identity
              </h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-base font-bold shadow-sm select-none shrink-0">
                  {djName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${theme === 'light' ? 'text-neutral-900' : 'text-white'}`}>{djName}</h4>
                  <p className="text-[10px] text-neutral-400">Primary Administrator Session</p>
                </div>
              </div>

              <div className="text-xs space-y-1.5 p-3 rounded-xl bg-neutral-500/5 border border-neutral-500/10">
                <span className="block font-bold text-neutral-400 uppercase text-[9px] tracking-widest">Active Station Description</span>
                <p className={`font-sans leading-relaxed text-xs ${theme === 'light' ? 'text-neutral-600' : 'text-neutral-300'}`}>
                  "{roomDesc || 'No active station description provided yet.'}"
                </p>
              </div>

              <button
                onClick={() => onNavigateTab('account')}
                className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-center cursor-pointer active:scale-98 transition-all ${
                  theme === 'light' ? 'bg-neutral-150 hover:bg-neutral-200 text-neutral-800' : 'bg-white/5 hover:bg-white/10 text-white'
                }`}
              >
                Edit Broadcast Identity
              </button>
            </div>
          </GlassCard>

          {/* Quick Info / User Guide Card */}
          <GlassCard theme={theme} className="p-6 text-left">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <h3 className={`text-xs font-bold uppercase tracking-wider ${
                theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'
              }`}>
                Quick Host Operations Manual
              </h3>
            </div>

            <div className={`space-y-3 text-xs leading-relaxed ${theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'}`}>
              <p>
                1. <span className="font-bold">Playlists & Replays:</span> Go to the <span className="font-semibold text-pink-500 cursor-pointer hover:underline" onClick={() => onNavigateTab('console')}>Console</span> tab to manage the incoming requests, approve/reject tracks, and view history.
              </p>
              <p>
                2. <span className="font-bold">Broadcasting Sound:</span> Open the <span className="font-semibold text-pink-500 cursor-pointer hover:underline" onClick={() => onNavigateTab('output')}>Output</span> player tab to start playback. This embeds the real video/audio player elements safely.
              </p>
              <p>
                3. <span className="font-bold">Password Security:</span> Change your administrator passcode from the <span className="font-semibold text-pink-500 cursor-pointer hover:underline" onClick={() => onNavigateTab('account')}>Account</span> hub.
              </p>
            </div>
          </GlassCard>
        </div>

      </div>
    </div>
  );
}
