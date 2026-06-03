import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { modifyAdminSecret } from '../lib/firebaseService';
import { useSessionTimer } from '../hooks/useSessionTimer';
import { 
  User, 
  LogOut, 
  Shield, 
  Sparkles,
  Sun,
  Moon,
  Clock,
  Lock,
  AlertOctagon,
  FileText,
  ListOrdered
} from 'lucide-react';

interface AccountViewProps {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  djName: string;
  setDjName: (name: string) => void;
  roomDesc: string;
  setRoomDesc: (desc: string) => void;
  activeStreamLimit: string;
  setActiveStreamLimit: (limit: string) => void;
  onLogout: () => void;
  onAlert: (msg: string, type: 'success' | 'error') => void;
  queue: any[];
  broadcastingHubLink: string;
  setBroadcastingHubLink: (link: string) => void;
}

export default function AccountView({
  theme,
  setTheme,
  djName,
  setDjName,
  roomDesc,
  setRoomDesc,
  activeStreamLimit,
  setActiveStreamLimit,
  onLogout,
  onAlert,
  queue,
  broadcastingHubLink,
  setBroadcastingHubLink
}: AccountViewProps) {
  const { formattedDuration } = useSessionTimer();
  
  // Config states initialized from props
  const [editingName, setEditingName] = useState(djName);
  const [editingRoomDesc, setEditingRoomDesc] = useState(roomDesc);
  const [editingLimit, setEditingLimit] = useState(activeStreamLimit);
  
  // Modal toggle state for sign-out confirmation
  const [showConfirm, setShowConfirm] = useState(false);

  // States for passcode configuration
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [isUpdatingPass, setIsUpdatingPass] = useState(false);

  // Sync state if props change externally
  useEffect(() => {
    setEditingName(djName);
  }, [djName]);

  useEffect(() => {
    setEditingRoomDesc(roomDesc);
  }, [roomDesc]);

  useEffect(() => {
    setEditingLimit(activeStreamLimit);
  }, [activeStreamLimit]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingName.trim()) {
      onAlert('Host Display Name cannot be empty.', 'error');
      return;
    }
    setDjName(editingName.trim());
    setRoomDesc(editingRoomDesc.trim());
    setActiveStreamLimit(editingLimit);
    onAlert('Host broadcast profile and identity configurations updated.', 'success');
  };

  const handleUpdatePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPass || !newPass || !confirmPass) {
      onAlert('Please satisfy all passcode form parameters.', 'error');
      return;
    }
    if (newPass !== confirmPass) {
      onAlert('New passcode and confirmation passcode mismatch.', 'error');
      return;
    }
    if (newPass.length < 4) {
      onAlert('New secret passcode must be at least 4 characters long.', 'error');
      return;
    }

    setIsUpdatingPass(true);
    try {
      const res = await modifyAdminSecret(currentPass, newPass);
      if (res.success) {
        onAlert('Administrative protection passcode updated successfully on Firestore database.', 'success');
        setCurrentPass('');
        setNewPass('');
        setConfirmPass('');
      } else {
        onAlert(res.error || 'Failed to modify passcode on database. Please check current password.', 'error');
      }
    } catch (err) {
      onAlert('Connection failure during passcode modification procedure.', 'error');
    } finally {
      setIsUpdatingPass(false);
    }
  };

  const totalTracks = queue.length;
  const totalPlayed = queue.filter(t => t.status === 'played').length;
  const currentPending = queue.filter(t => t.status === 'queued').length;

  // Minimal flat hover options
  const cardHoverProps = {
    whileHover: { scale: 1 },
    whileTap: { scale: 1 },
    transition: { duration: 0.1 }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-16">
      {/* Page Title Header */}
      <div className="text-left">
        <h2 className={`text-2xl font-bold font-sans tracking-tight ${theme === 'light' ? 'text-neutral-900' : 'text-white'}`}>
          Account Hub & Broadcast Identity
        </h2>
        <p className={`text-xs mt-1.5 font-sans leading-relaxed ${theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'}`}>
          Manage your live stream's profile, custom visitor interface messaging, page theme visuals, and secure server tokens.
        </p>
      </div>

      <div className="space-y-6">
        {/* Apple Style Large Profile Card */}
        <motion.div 
          {...cardHoverProps}
          className={`p-6 rounded-[24px] border flex flex-col md:flex-row items-center gap-6 shadow-sm cursor-default select-none ${
            theme === 'light' 
              ? 'bg-white border-neutral-200' 
              : 'bg-zinc-900/50 border-white/5 backdrop-blur-md'
          }`}
        >
          {/* Avatar frame */}
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-full flex items-center justify-center text-white text-3xl font-bold tracking-tight shadow-md select-none">
              {djName.trim() ? djName.substring(0, 2).toUpperCase() : 'DJ'}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-2 border-white dark:border-zinc-900 rounded-full flex items-center justify-center" title="Host Online">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            </div>
          </div>

          <div className="flex-1 text-center md:text-left space-y-1">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <h3 className={`text-xl font-bold font-sans tracking-tight ${theme === 'light' ? 'text-neutral-950' : 'text-[#F5F5F7]'}`}>
                {djName}
              </h3>
              <span className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-widest font-mono font-semibold">
                Chief Host
              </span>
            </div>
            <p className="text-xs font-mono text-neutral-400 dark:text-neutral-500">
              Broadcasting Hub Link: <span className="underline decoration-indigo-400/50">{broadcastingHubLink}</span>
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1.5 mt-2.5">
              <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Session: Just Now (UTC)</span>
              </div>
              <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-pink-500 animate-pulse" />
                <span>Session Duration: <strong className="font-mono text-pink-500">{formattedDuration}</strong></span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Configuration Sections - Apple Settings layout style */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column Settings Group */}
          <div className="space-y-6">
            
            {/* Identity & Broadcast Parameters Card */}
            <motion.div 
              {...cardHoverProps}
              className={`p-6 rounded-[22px] border space-y-4 text-left ${
                theme === 'light' ? 'bg-white border-neutral-200' : 'bg-zinc-900/40 border-white/5'
              }`}
            >
              <h4 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${
                theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'
              }`}>
                <User className="w-4 h-4 text-purple-500" /> Host & Broadcast Parameters
              </h4>

              <form onSubmit={handleSaveSettings} className="space-y-4 pt-1">
                <div>
                  <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${
                    theme === 'light' ? 'text-neutral-400' : 'text-neutral-500'
                  }`}>
                    Display Nickname
                  </label>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className={`w-full border rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-purple-500 transition-all font-sans ${
                      theme === 'light' 
                        ? 'bg-neutral-50 border-neutral-250 text-neutral-900 shadow-inner' 
                        : 'bg-black/30 border-white/5 text-white'
                    }`}
                    placeholder="e.g. Chief DJ Host"
                  />
                </div>

                <div>
                  <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${
                    theme === 'light' ? 'text-neutral-400' : 'text-neutral-500'
                  }`}>
                    Active Stream Limit
                  </label>
                  <select
                    value={editingLimit}
                    onChange={(e) => setEditingLimit(e.target.value)}
                    className={`w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-all font-sans cursor-pointer ${
                      theme === 'light' 
                        ? 'bg-neutral-50 border-neutral-250 text-neutral-900 shadow-inner' 
                        : 'bg-black/30 border-white/5 text-white'
                    }`}
                  >
                    <option value="50">50 Songs Max</option>
                    <option value="100">100 Songs Max</option>
                    <option value="unlimited">Unlimited requests</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${
                    theme === 'light' ? 'text-neutral-400' : 'text-neutral-500'
                  }`}>
                    Broadcast Room Description
                  </label>
                  <textarea
                    rows={2}
                    value={editingRoomDesc}
                    onChange={(e) => setEditingRoomDesc(e.target.value)}
                    className={`w-full border rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-purple-500 transition-all font-sans resize-none ${
                      theme === 'light' 
                        ? 'bg-neutral-50 border-neutral-250 text-neutral-900 shadow-inner' 
                        : 'bg-black/30 border-white/5 text-white'
                    }`}
                    placeholder="Describe this audio room..."
                  />
                </div>

                <button
                  type="submit"
                  className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-150 text-center cursor-pointer shadow-sm active:scale-[0.98] ${
                    theme === 'light' 
                      ? 'bg-neutral-900 hover:bg-neutral-800 text-white' 
                      : 'bg-white hover:bg-neutral-100 text-black'
                  }`}
                >
                  Save Profile Settings
                </button>
              </form>
            </motion.div>

            {/* Broadcast Statistics */}
            <motion.div 
              {...cardHoverProps}
              className={`p-6 rounded-[22px] border space-y-3.5 text-left ${
                theme === 'light' ? 'bg-white border-neutral-200' : 'bg-zinc-900/40 border-white/5'
              }`}
            >
              <h4 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${
                theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'
              }`}>
                <Sparkles className="w-4 h-4 text-pink-500" /> Live Statistics
              </h4>

              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-neutral-100 dark:border-white/5">
                  <span className="text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                    <ListOrdered className="w-3.5 h-3.5 text-purple-400" /> Total Track Submissions
                  </span>
                  <span className="font-mono font-bold text-neutral-900 dark:text-white">{totalTracks}</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-neutral-100 dark:border-white/5">
                  <span className="text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" /> Total Played History
                  </span>
                  <span className="font-mono font-bold text-emerald-500">{totalPlayed}</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-neutral-100 dark:border-white/5">
                  <span className="text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-400" /> Active Queue Tasks
                  </span>
                  <span className="font-mono font-bold text-indigo-400">{currentPending}</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5">
                  <span className="text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-pink-400 animate-pulse shrink-0" /> Session Duration
                  </span>
                  <span className="font-mono font-bold text-pink-500">{formattedDuration}</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column Settings Group */}
          <div className="space-y-6">
            {/* Change Host Passcode Panel */}
            <motion.div 
              {...cardHoverProps}
              className={`p-6 rounded-[22px] border space-y-4 text-left ${
                theme === 'light' ? 'bg-white border-neutral-200' : 'bg-zinc-900/40 border-white/5'
              }`}
            >
              <h4 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${
                theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'
              }`}>
                <Lock className="w-4 h-4 text-pink-500" /> Change Host Passcode
              </h4>

              <p className={`text-xs leading-relaxed ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                Re-encrypt your administrative gating system by defining a new high-security host passcode (at least 4 characters).
              </p>

              <form onSubmit={handleUpdatePasscode} className="space-y-3 pt-1">
                <div>
                  <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                    theme === 'light' ? 'text-neutral-400' : 'text-neutral-500'
                  }`}>
                    Current Passcode
                  </label>
                  <input
                    type="password"
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    required
                    placeholder="••••"
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-pink-500 transition-all font-sans ${
                      theme === 'light' 
                        ? 'bg-[#F2F2F7] border-neutral-250 text-neutral-900' 
                        : 'bg-black/30 border-white/5 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                    theme === 'light' ? 'text-neutral-400' : 'text-neutral-500'
                  }`}>
                    New Passcode
                  </label>
                  <input
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    required
                    placeholder="••••"
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-pink-500 transition-all font-sans ${
                      theme === 'light' 
                        ? 'bg-[#F2F2F7] border-neutral-250 text-neutral-900' 
                        : 'bg-black/30 border-white/5 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                    theme === 'light' ? 'text-neutral-400' : 'text-neutral-500'
                  }`}>
                    Confirm New Passcode
                  </label>
                  <input
                    type="password"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    required
                    placeholder="••••"
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-pink-500 transition-all font-sans ${
                      theme === 'light' 
                        ? 'bg-[#F2F2F7] border-[#C8C7CC] text-neutral-900' 
                        : 'bg-black/30 border-white/5 text-white'
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingPass}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-150 text-center cursor-pointer shadow-sm active:scale-[0.98] mt-2 flex items-center justify-center gap-1.5 ${
                    theme === 'light' 
                      ? 'bg-neutral-900 hover:bg-neutral-800 text-white' 
                      : 'bg-white hover:bg-neutral-100 text-black'
                  }`}
                >
                  {isUpdatingPass ? 'Updating Passcode...' : 'Update Secret Passcode'}
                </button>
              </form>
            </motion.div>

            {/* Theme Settings Mode */}
            <motion.div 
              {...cardHoverProps}
              className={`p-6 rounded-[22px] border space-y-4 text-left ${
                theme === 'light' ? 'bg-white border-neutral-200' : 'bg-zinc-900/40 border-white/5'
              }`}
            >
              <h4 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${
                theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'
              }`}>
                <Shield className="w-4 h-4 text-blue-500" /> Workspace Appearance
              </h4>

              <p className={`text-xs leading-relaxed ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                Toggle the unified display environment configuration across the entire user session interface.
              </p>

              <div className="grid grid-cols-2 gap-3.5 pt-1">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-150 cursor-pointer active:scale-95 ${
                    theme === 'light'
                      ? 'bg-neutral-100 border-neutral-400 text-neutral-900 shadow-sm font-extrabold'
                      : 'bg-black/10 border-white/5 text-neutral-450 hover:text-white'
                  }`}
                >
                  <Sun className={`w-5 h-5 mb-2 ${theme === 'light' ? 'text-amber-500' : ''}`} />
                  <span className="text-xs font-semibold">Light Contrast</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-150 cursor-pointer active:scale-95 ${
                    theme === 'dark'
                      ? 'bg-zinc-800 border-white/20 text-white shadow-sm font-extrabold'
                      : 'bg-neutral-50 border-neutral-250 text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <Moon className={`w-5 h-5 mb-2 ${theme === 'dark' ? 'text-purple-400' : ''}`} />
                  <span className="text-xs font-semibold">Dark Stealth</span>
                </button>
              </div>
            </motion.div>

            {/* Apple Style Sign Out Group (Action Card) */}
            <motion.div 
              {...cardHoverProps}
              className={`p-6 rounded-[22px] border space-y-4 text-left ${
                theme === 'light' ? 'bg-white border-neutral-200' : 'bg-zinc-900/40 border-white/5'
              }`}
            >
              <h4 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${
                theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'
              }`}>
                <Lock className="w-4 h-4 text-red-500" /> Security Session
              </h4>

              <p className={`text-xs leading-relaxed ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                Signing out completely clears the cached token authorization and locks the host command workspace.
              </p>

              <div className="pt-2">
                <button
                  onClick={() => setShowConfirm(true)}
                  type="button"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 hover:bg-red-500 hover:text-white dark:bg-red-500/10 dark:hover:bg-red-650 text-red-650 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-150 hover:shadow-lg active:scale-[0.98] cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Log Out of Session</span>
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog Component */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            
            {/* Modal Box */}
            <motion.div 
              initial={{ scale: 0.93, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.93, y: 15, opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 22 }}
              className={`relative z-10 w-full max-w-sm rounded-[28px] border p-6 shadow-2xl overflow-hidden ${
                theme === 'light' 
                  ? 'bg-white border-neutral-250 text-neutral-900' 
                  : 'bg-[#1C1C1E]/95 border-white/10 text-white backdrop-blur-2xl'
              }`}
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-red-550/10 dark:bg-red-500/15 flex items-center justify-center text-red-500">
                  <AlertOctagon className="w-6 h-6 animate-pulse" />
                </div>
                
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold tracking-tight font-sans">
                    Confirm Sign Out
                  </h3>
                  <p className={`text-xs leading-relaxed font-sans max-w-xs ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    Are you sure you want to end your Chief DJ Session? All administrative tools will be locked until the author passcode is supplied again.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full pt-4">
                  <button
                    type="button"
                    onClick={() => setShowConfirm(false)}
                    className={`py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider border cursor-pointer select-none transition-all duration-150 active:scale-95 ${
                      theme === 'light'
                        ? 'border-neutral-200 text-neutral-500 bg-neutral-50 hover:bg-neutral-100'
                        : 'border-white/10 bg-white/5 hover:bg-white/10 text-neutral-300'
                    }`}
                  >
                    Keep Session
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowConfirm(false);
                      onLogout();
                    }}
                    className="py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-red-650 hover:bg-red-600 text-white cursor-pointer select-none transition-all duration-150 active:scale-95 shadow-md shadow-red-500/10"
                  >
                    Yes, Log Out
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
