import React, { useState } from 'react';
import { Socket } from 'socket.io-client';
import { Track, PlaybackState } from '../types';
import { apiFetch } from '../utils';
import GlassCard from './GlassCard';
import { Search, Plus, ThumbsUp, Music, User, Clock, Check, Loader2, Play, Pause } from 'lucide-react';

interface PublicViewProps {
  socket: Socket | null;
  queue: Track[];
  playbackState: PlaybackState;
  onAlert: (msg: string, type: 'success' | 'error') => void;
  theme: 'light' | 'dark';
}

export default function PublicView({ socket, queue, playbackState, onAlert, theme }: PublicViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [userName, setUserName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [resolvedTrack, setResolvedTrack] = useState<{
    title: string;
    artist: string;
    youtubeId: string;
    artworkUrl: string;
    duration: number;
  } | null>(null);

  const activeTrack = queue.find(t => t.id === playbackState.currentTrackId);

  // Trigger Gemini resolution
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setResolvedTrack(null);

    try {
      const response = await apiFetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!response.ok) {
        throw new Error('Failed to resolve song metadata');
      }

      const data = await response.json();
      setResolvedTrack(data);
    } catch (err: any) {
      onAlert(err.message || 'Error occurred searching song.', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // Confirm request & emit update through socket
  const handleConfirmRequest = () => {
    if (!resolvedTrack || !socket) return;

    socket.emit('add_request', {
      title: resolvedTrack.title,
      artist: resolvedTrack.artist,
      url: `https://www.youtube.com/watch?v=${resolvedTrack.youtubeId}`,
      youtubeId: resolvedTrack.youtubeId,
      artworkUrl: resolvedTrack.artworkUrl,
      duration: resolvedTrack.duration,
      requestedBy: userName.trim() || 'Anonymous Fan',
      originalName: resolvedTrack.originalName,
      originalArtist: resolvedTrack.originalArtist,
      originalCover: resolvedTrack.originalCover,
      originalLabel: resolvedTrack.originalLabel,
    });

    onAlert(`"${resolvedTrack.title}" requested successfully!`, 'success');
    setResolvedTrack(null);
    setSearchQuery('');
  };

  // Upvote socket emitter
  const handleUpvote = (trackId: string) => {
    if (!socket) return;
    socket.emit('vote_request', { id: trackId, increment: 1 });
  };

  // Formatter for seconds -> min:sec
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const pendingQueue = queue
    .filter(t => t.status === 'queued')
    .sort((a, b) => b.votes - a.votes || new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 1. Header / Intro Banner */}
      <div className="text-center md:text-left space-y-3">
        <h1 className="text-4xl md:text-5xl font-sans tracking-tight font-extrabold bg-gradient-to-r from-neutral-900 to-neutral-650 dark:from-white dark:via-neutral-100 dark:to-neutral-400 bg-clip-text text-transparent">
          Request a Vibe.
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 text-lg max-w-2xl font-mono">
          Paste streaming links or search keywords, and our AI resolves the metadata to update the host's queue instantly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* 2. Request Input Panel */}
          <GlassCard theme={theme} className="p-6">
            <h2 className="text-xl font-sans font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
              <Music className="w-5 h-5 text-pink-500" /> Specify Track
            </h2>

            <form onSubmit={handleSearchSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-neutral-500 dark:text-white/40 uppercase tracking-widest mb-1.5">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-3.5 w-4 h-4 text-neutral-400 dark:text-white/20" />
                    <input
                      type="text"
                      placeholder="e.g. DJ Guest"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full bg-neutral-100 dark:bg-white/10 border border-neutral-300 dark:border-white/15 rounded-2xl py-3 pl-11 pr-4 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-white/25 text-sm focus:outline-none focus:border-purple-500 transition-all font-sans"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-500 dark:text-white/40 uppercase tracking-widest mb-1.5">
                    Song Link or Keyword
                  </label>
                  <div className="relative">
                    <Search className="absolute left-4 top-3.5 w-4 h-4 text-neutral-400 dark:text-white/20" />
                    <input
                      type="text"
                      placeholder="YouTube, SoundCloud links or Search terms..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      required
                      className="w-full bg-neutral-100 dark:bg-white/10 border border-neutral-300 dark:border-white/15 rounded-2xl py-3 pl-11 pr-4 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-white/25 text-sm focus:outline-none focus:border-purple-500 transition-all font-sans"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSearching}
                  className="w-full md:w-auto px-6 py-3 bg-neutral-900 text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-lg"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Resolving Track Metadata...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" /> Resolve Song with Gemini
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Resolved Metadata Preview Dialog */}
            {resolvedTrack && (
              <div className="mt-6 border border-neutral-200 dark:border-white/10 p-5 rounded-2xl bg-neutral-100/50 dark:bg-white/5 animate-fade-in space-y-4">
                <p className="text-xs font-mono tracking-wider text-pink-400 uppercase">
                  Gemini Resolved Metadata:
                </p>
                <div className="flex items-center gap-4">
                  <img
                    src={resolvedTrack.artworkUrl}
                    alt={resolvedTrack.title}
                    referrerPolicy="no-referrer"
                    className="w-20 h-20 rounded-xl object-cover border border-neutral-200 dark:border-white/10"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-base font-semibold text-neutral-900 dark:text-white truncate font-sans">
                      {resolvedTrack.title}
                    </h4>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate mt-1">
                      {resolvedTrack.artist}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {formatTime(resolvedTrack.duration)}
                      </span>
                      <span>•</span>
                      <span>YouTube Paired Audio</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-2 border-t border-neutral-200 dark:border-white/5">
                  <button
                    onClick={() => setResolvedTrack(null)}
                    className="px-4 py-2 bg-neutral-200 text-neutral-800 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700 rounded-lg text-xs font-sans transition-all cursor-pointer"
                  >
                    Clear Search
                  </button>
                  <button
                    onClick={handleConfirmRequest}
                    className="px-5 py-2 bg-neutral-900 text-white dark:bg-white dark:text-black font-semibold rounded-lg text-xs hover:bg-neutral-800 dark:hover:bg-neutral-200 font-sans transition-all flex items-center gap-1 shadow-lg cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 text-green-600 stroke-[3]" /> Add to Queue
                  </button>
                </div>
              </div>
            )}
          </GlassCard>

          {/* 3. Playlist Queue Panel */}
          <GlassCard theme={theme} className="p-6">
            <h3 className="text-xl font-sans font-semibold text-neutral-900 dark:text-white mb-6 flex items-center justify-between">
              <span>Upvote Queue</span>
              <span className="text-xs bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 px-3 py-1.5 rounded-full font-mono">
                {pendingQueue.length} Track{pendingQueue.length === 1 ? '' : 's'} Waiting
              </span>
            </h3>

            {pendingQueue.length === 0 ? (
              <div className="text-center py-12 text-neutral-500 space-y-3">
                <Music className="w-10 h-10 mx-auto text-neutral-600 block" />
                <p className="font-sans text-sm">The playlist queue is fully empty.</p>
                <p className="font-mono text-xs text-neutral-400 dark:text-neutral-600">Be the first to request a song above!</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-200 dark:divide-white/5">
                {pendingQueue.map((track, idx) => (
                  <div
                    key={track.id}
                    className="flex items-center justify-between py-4 group hover:bg-neutral-100 dark:hover:bg-white/[0.02] -mx-4 px-4 rounded-xl transition-all"
                  >
                    <div className="flex items-center gap-4 min-w-0 pr-4">
                      {/* Ranking Index */}
                      <span className="font-mono text-neutral-500 font-bold text-sm w-4 text-center">
                        {idx + 1}
                      </span>
                      <img
                        src={track.artworkUrl}
                        alt="Album Cover"
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-lg object-cover border border-neutral-200 dark:border-white/5"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600';
                        }}
                      />
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-neutral-900 dark:text-white truncate font-sans">
                          {track.title}
                        </h4>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                          {track.artist}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono text-neutral-400 dark:text-neutral-500">
                          <span className="bg-neutral-200/50 dark:bg-white/5 px-1.5 py-0.5 rounded text-neutral-600 dark:text-neutral-400 truncate max-w-[120px]">
                            req: {track.requestedBy}
                          </span>
                          <span>•</span>
                          <span>{formatTime(track.duration)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-sm font-mono font-bold text-neutral-800 dark:text-white bg-neutral-200/80 dark:bg-neutral-800/80 px-2.5 py-1 rounded-lg">
                        {track.votes}
                      </span>
                      <button
                        onClick={() => handleUpvote(track.id)}
                        className="p-2.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full text-pink-500 dark:text-pink-400 hover:text-pink-600 dark:hover:text-pink-300 transition-all cursor-pointer bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-white/5 active:scale-95 animate-fade-in"
                        title="Vouch for track"
                      >
                        <ThumbsUp className="w-4 h-4 fill-pink-500/20" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* 4. Active Sound Deck Monitor */}
        <div className="lg:col-span-1 space-y-6">
          <GlassCard theme={theme} className="p-6">
            <h3 className="text-lg font-sans font-semibold text-neutral-900 dark:text-white mb-4">Currently Playing</h3>

            {activeTrack ? (
              <div className="space-y-4">
                <div className="relative group rounded-xl overflow-hidden border border-neutral-200 dark:border-white/15 aspect-square">
                  <img
                    src={activeTrack.artworkUrl}
                    alt={activeTrack.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600';
                    }}
                  />
                  
                  {/* Glass backing blur container overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-none flex items-end p-4">
                    <div className="text-white min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-pink-400 text-[10px] font-mono font-bold tracking-widest uppercase mb-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-pink-500 animate-ping" /> Broadcast Live
                      </div>
                      <h4 className="text-base font-bold truncate font-sans">{activeTrack.title}</h4>
                      <p className="text-xs text-neutral-350 truncate">{activeTrack.artist}</p>
                    </div>
                  </div>
                </div>

                {/* Micro-Progress meter */}
                <div className="space-y-1">
                  <div className="w-full bg-neutral-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden relative">
                    <div
                      className="bg-gradient-to-r from-pink-500 to-purple-600 h-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          (playbackState.progress / (activeTrack.duration || 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                    <span>{formatTime(playbackState.progress)}</span>
                    <span>{formatTime(activeTrack.duration)}</span>
                  </div>
                </div>

                <div className="flex justify-center items-center py-1">
                  <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-900/60 font-mono text-xs border border-neutral-300 dark:border-white/5 text-neutral-700 dark:text-neutral-300 px-4 py-2 rounded-full">
                    {playbackState.status === 'playing' ? (
                      <>
                        <Play className="w-3.5 h-3.5 text-green-500 dark:text-green-400 fill-current animate-pulse" /> Playing on output device
                      </>
                    ) : (
                      <>
                        <Pause className="w-3.5 h-3.5 text-neutral-400" /> Paused
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-neutral-500 space-y-4">
                <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 flex items-center justify-center mx-auto text-neutral-400">
                  <Music className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="font-sans text-sm">No Active Playback</p>
                  <p className="font-mono text-xs text-neutral-600">Waiting for Host to press PLAY</p>
                </div>
              </div>
            )}
          </GlassCard>

          {/* Guidelines info card */}
          <GlassCard theme={theme} className="p-6">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-white font-sans mb-2">Guest Rules</h4>
            <ul className="text-xs text-neutral-500 dark:text-neutral-400 font-mono space-y-2 list-disc list-inside">
              <li>Upvotes boost a song's priority in the queue.</li>
              <li>You can request custom streaming links or common keywords.</li>
              <li>Real-time database ensures exact synchronizations for the DJ dashboard.</li>
            </ul>
          </GlassCard>
        </div>
      </div>

      {/* Dynamic Floating Bottom Audio Player */}
      {activeTrack && (
        <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-xl z-50 transition-all duration-300">
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 shadow-2xl backdrop-blur-md ${
            theme === 'light'
              ? 'bg-white/95 border-neutral-300 text-neutral-900 shadow-neutral-900/10'
              : 'bg-zinc-950/95 border-white/10 text-white shadow-black/80'
          }`}>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <img
                src={activeTrack.artworkUrl}
                alt={activeTrack.title}
                className="w-11 h-11 rounded-lg object-cover shrink-0 border border-neutral-300 dark:border-white/10 shadow-sm"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=300';
                }}
              />
              <div className="min-w-0 text-left">
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-pink-500 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse" /> BROADCASTING LIVE
                </span>
                <h4 className="text-xs font-bold font-sans truncate">{activeTrack.title}</h4>
                <p className="text-[10px] text-neutral-400 font-medium truncate">{activeTrack.artist}</p>
              </div>
            </div>

            {/* Progress Bar & Counter */}
            <div className="flex flex-col items-end gap-1 shrink-0 font-mono text-[9px] text-neutral-500 dark:text-neutral-400">
              <div className="flex items-center gap-1">
                <span>{formatTime(playbackState.progress)}</span>
                <span>/</span>
                <span>{formatTime(activeTrack.duration)}</span>
              </div>
              <div className="w-24 bg-neutral-200 dark:bg-white/10 h-1 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-pink-500 to-purple-600 h-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (playbackState.progress / (activeTrack.duration || 1)) * 100)}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
