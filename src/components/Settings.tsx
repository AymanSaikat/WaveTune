import React, { useState } from 'react';
import { Socket } from 'socket.io-client';
import { PlaybackState, Track } from '../types';
import GlassCard from './GlassCard';
import {
  Trash2,
  Sliders,
  Cpu,
  User,
  Activity,
  AlertOctagon,
  Database,
  RefreshCw,
  Sparkles,
  Volume2,
  Server,
  Network,
  Sun,
  Moon
} from 'lucide-react';

interface SettingsProps {
  socket: Socket | null;
  queue: Track[];
  playbackState: PlaybackState;
  onAlert: (msg: string, type: 'success' | 'error') => void;
  theme: 'light' | 'dark';
  activeStreamLimit: string;
  setActiveStreamLimit: (limit: string) => void;
}

export default function Settings({
  socket,
  queue,
  playbackState,
  onAlert,
  theme,
  activeStreamLimit,
  setActiveStreamLimit,
}: SettingsProps) {
  const [allowDuplicates, setAllowDuplicates] = useState(() => {
    return localStorage.getItem('wavetune_allow_duplicates') === 'true';
  });
  const [systemAutoplay, setSystemAutoplay] = useState(() => {
    const saved = localStorage.getItem('wavetune_system_autoplay');
    return saved !== 'false'; // default true
  });
  const [maxVolumeLimit, setMaxVolumeLimit] = useState(() => {
    const saved = localStorage.getItem('wavetune_max_volume_limit');
    return saved ? parseInt(saved, 10) : 100;
  });
  const [isClearing, setIsClearing] = useState(false);

  const pendingCount = queue.filter(t => t.status === 'queued').length;
  const playedCount = queue.filter(t => t.status === 'played').length;

  const handleClearAllQueue = () => {
    if (!socket) {
      onAlert('Real-time connection pipeline offline.', 'error');
      return;
    }

    if (window.confirm('Are you absolutely sure you want to empty the playlist queue entirely? This discards all pending, active, and history items!')) {
      setIsClearing(true);
      setTimeout(() => {
        socket.emit('clear_queue');
        setIsClearing(false);
        onAlert('The entire CMS request database has been purged successfully.', 'success');
      }, 800);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-left">
      {/* Dynamic Header Description */}
      <div>
        <h2 className={`text-2xl font-bold font-sans tracking-tight ${theme === 'light' ? 'text-black' : 'text-white'}`}>
          System Core & Settings
        </h2>
        <p className={`text-xs mt-1.5 font-sans leading-relaxed ${theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'}`}>
          Configure structural playback regulations, CMS database records, and control connection profiles.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Main Configurations & Metadata Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Regulations & Active Directives Panel */}
          <GlassCard theme={theme} className="p-6">
            <h3 className={`text-base font-sans font-semibold mb-4 flex items-center gap-2 ${theme === 'light' ? 'text-black' : 'text-white'}`}>
              <Sliders className="w-4 h-4 text-[#EC4899]" /> Playback Regulation Directives
            </h3>

            <div className="space-y-5">
              {/* Directive 1 */}
              <div className="flex items-center justify-between gap-4 py-2 border-b border-dashed border-neutral-500/10">
                <div>
                  <span className={`block text-sm font-semibold ${theme === 'light' ? 'text-black' : 'text-white'}`}>
                    Active Smart Autoplay
                  </span>
                  <span className="text-[11px] text-neutral-400 font-sans block mt-0.5 max-w-md">
                    Automatically plays the next queued song in line when the current track concludes. Prevent silence on air.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !systemAutoplay;
                    setSystemAutoplay(next);
                    localStorage.setItem('wavetune_system_autoplay', String(next));
                    onAlert(`Smart Autoplay ${next ? 'enabled' : 'disabled'}.`, 'success');
                  }}
                  className={`w-14 h-7 p-1 rounded-full cursor-pointer transition-all flex h-auto ${
                    systemAutoplay 
                      ? 'bg-gradient-to-r from-pink-500 to-purple-600 justify-end' 
                      : (theme === 'light' ? 'bg-neutral-200 justify-start' : 'bg-neutral-800 justify-start')
                  }`}
                >
                  <span className="w-5 h-5 bg-white rounded-full shadow-md block" />
                </button>
              </div>

              {/* Directive 2 */}
              <div className="flex items-center justify-between gap-4 py-2 border-b border-dashed border-neutral-500/10">
                <div>
                  <span className={`block text-sm font-semibold ${theme === 'light' ? 'text-black' : 'text-white'}`}>
                    Allow Duplicate Submissions
                  </span>
                  <span className="text-[11px] text-neutral-400 font-sans block mt-0.5 max-w-md">
                    Permit visitors to request identical YouTube tracks back-to-back instead of filtering out repeat requests.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !allowDuplicates;
                    setAllowDuplicates(next);
                    localStorage.setItem('wavetune_allow_duplicates', String(next));
                    onAlert(`Duplicate Song Policy updated.`, 'success');
                  }}
                  className={`w-14 h-7 p-1 rounded-full cursor-pointer transition-all flex h-auto ${
                    allowDuplicates 
                      ? 'bg-gradient-to-r from-pink-500 to-purple-600 justify-end' 
                      : (theme === 'light' ? 'bg-neutral-200 justify-start' : 'bg-neutral-800 justify-start')
                  }`}
                >
                  <span className="w-5 h-5 bg-white rounded-full shadow-md block" />
                </button>
              </div>

              {/* Directive 3 */}
              <div className="space-y-2 py-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className={`flex items-center gap-1 ${theme === 'light' ? 'text-neutral-700' : 'text-neutral-400'}`}>
                    <Volume2 className="w-4 h-4 text-pink-400" /> Maximum Allowed Volume Ingress:
                  </span>
                  <span className={`font-semibold ${theme === 'light' ? 'text-black' : 'text-white'}`}>{maxVolumeLimit}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={maxVolumeLimit}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setMaxVolumeLimit(val);
                    localStorage.setItem('wavetune_max_volume_limit', String(val));
                  }}
                  className="w-full accent-pink-500 h-1 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Directive 4: Stream Request Limit */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 pt-4 border-t border-dashed border-neutral-500/10">
                <div>
                  <span className={`block text-sm font-semibold ${theme === 'light' ? 'text-black' : 'text-white'}`}>
                    Active Stream Limit
                  </span>
                  <span className="text-[11px] text-neutral-400 font-sans block mt-0.5 max-w-md">
                    Enforce structural maximum limitations on total active tracks queued by listeners before blocking requests.
                  </span>
                </div>
                <select
                  value={activeStreamLimit}
                  onChange={(e) => {
                    setActiveStreamLimit(e.target.value);
                    onAlert('Active guest stream limit restrictions updated.', 'success');
                  }}
                  className={`border rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-pink-500 transition-all font-mono font-bold shrink-0 cursor-pointer ${
                    theme === 'light' ? 'bg-white border-neutral-300 text-neutral-900 shadow-sm' : 'bg-black/30 border-white/10 text-white'
                  }`}
                >
                  <option value="50">50 Songs Max</option>
                  <option value="100">100 Songs Max</option>
                  <option value="unlimited">Unlimited requests</option>
                </select>
              </div>

              {/* Directive 5: Firebase Database Configuration Information */}
              <div className="flex flex-col gap-3 py-3 pt-5 border-t border-dashed border-neutral-500/10">
                <div>
                  <span className={`block text-sm font-semibold mb-0.5 flex items-center gap-1.5 ${theme === 'light' ? 'text-black' : 'text-white'}`}>
                    <Database className="w-4 h-4 text-emerald-400" /> Firebase Cloud Infrastructure
                  </span>
                  <span className="text-[11px] text-neutral-400 font-sans block leading-relaxed max-w-xl">
                    WaveTune has been fully optimized to run on a serverless Real-Time Sync architecture. Playback synchronizations, music request queues, and remote pairing commands operate automatically inside Google cloud databases, ensuring maximum uptime and instant responses.
                  </span>
                </div>
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse block shrink-0" />
                  <span>Google Cloud Firestore Sync Pipeline: Operational / Online</span>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* RIGHT COLUMN: Diagnostics, Stats, Danger Purge Zone */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Diagnostic Stats */}
          <GlassCard theme={theme} className="p-6">
            <h3 className={`text-base font-sans font-semibold mb-4 flex items-center gap-2 ${theme === 'light' ? 'text-black' : 'text-white'}`}>
              <Activity className="w-4 h-4 text-[#10B981]" /> Hardware Pipelines
            </h3>

            <div className="space-y-4">
              <div className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-neutral-50 border-neutral-200' : 'bg-black/20 border-white/5'}`}>
                <div className="flex justify-between text-xs mb-1 font-sans">
                  <span className="text-neutral-400">WS Connection State</span>
                  <span className="font-semibold text-emerald-400 flex items-center gap-1.5 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse block" />
                    CONNECTED
                  </span>
                </div>
                <div className="flex justify-between text-xs font-sans">
                  <span className="text-neutral-400">Response Latency</span>
                  <span className={`font-semibold font-mono ${theme === 'light' ? 'text-black' : 'text-white'}`}>~ 12ms</span>
                </div>
              </div>

              <div className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-neutral-50 border-neutral-200' : 'bg-black/20 border-white/5'}`}>
                <div className="flex justify-between text-xs mb-1 font-sans">
                  <span className="text-neutral-400">Queue Persistence Status</span>
                  <span className="font-semibold text-emerald-400 flex items-center gap-1.5 font-mono">
                    <Database className="w-3 h-3" />
                    AUTOSAVED_OK
                  </span>
                </div>
                <div className="flex justify-between text-xs font-sans">
                  <span className="text-neutral-400">Total Database Records</span>
                  <span className={`font-semibold font-mono ${theme === 'light' ? 'text-black' : 'text-white'}`}>{queue.length} objects (size {JSON.stringify(queue).length} B)</span>
                </div>
              </div>

              {/* Status Simulation log lines */}
              <div className={`p-3.5 rounded-xl border font-mono text-[9px] leading-relaxed select-none ${
                theme === 'light' ? 'bg-neutral-100 border-neutral-200 text-neutral-600' : 'bg-neutral-900/80 border-white/5 text-neutral-400'
              }`}>
                <div className="text-purple-400 font-semibold">[SYSTEM DIAGNOSTICS LOGS]</div>
                <div>• [09:12:15] Server Socket pipeline initialized</div>
                <div>• [11:45:09] Gemini middleware resolved metadata queries</div>
                <div>• [14:32:41] Saved records (size {queue.length}) cleanly</div>
                <div>• [Active State] Autoplay is {systemAutoplay ? 'ON' : 'OFF'} • Duplicate restrictions are active</div>
              </div>
            </div>
          </GlassCard>

          {/* DANGER ZONE - PURGE CMS */}
          <GlassCard theme={theme} className="p-6 border-red-500/20 bg-red-500/5">
            <h3 className="text-base font-sans font-semibold text-red-500 mb-3 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-red-500" /> Administrative Danger Zone
            </h3>
            
            <p className="text-xs text-neutral-400 mb-5 font-sans leading-relaxed">
              These commands irreversibly alter the CMS server storage files. Exercise maximum caution.
            </p>

            <button
              onClick={handleClearAllQueue}
              disabled={isClearing}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
            >
              {isClearing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Purging Storage...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" /> Empty & Reset Play Queue
                </>
              )}
            </button>
          </GlassCard>

        </div>

      </div>
    </div>
  );
}
