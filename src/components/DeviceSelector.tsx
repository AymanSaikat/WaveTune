import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Shield, 
  HelpCircle, 
  CheckCircle2, 
  Play, 
  Pause, 
  AlertOctagon, 
  Loader2, 
  Laptop,
  Check
} from 'lucide-react';

interface DeviceSelectorProps {
  audioElementRef?: React.RefObject<HTMLAudioElement | null>;
  theme: 'light' | 'dark';
  onAlert?: (msg: string, type: 'success' | 'error') => void;
}

interface AudioOutputDevice {
  deviceId: string;
  label: string;
  group: string;
}

export default function DeviceSelector({ audioElementRef, theme, onAlert }: DeviceSelectorProps) {
  const isSelfInsideIframe = typeof window !== 'undefined' && window.self !== window.top;
  
  const [devices, setDevices] = useState<AudioOutputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => {
    return localStorage.getItem('wavetune_output_device_id') || 'default';
  });
  
  // Permission, discovery, and capability status lifecycle
  const [statusState, setStatusState] = useState<'loading' | 'permission-required' | 'ready' | 'not-supported'>('loading');
  const [permissionDeclined, setPermissionDeclined] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
  // Independent standard diagnostic/test audio stream
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);

  // Detect setSinkId routing capability
  const isSetSinkIdSupported = typeof HTMLAudioElement !== 'undefined' && 'setSinkId' in HTMLAudioElement.prototype;

  // Initialize and register stable local diagnostic sound element
  useEffect(() => {
    const testAudio = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3');
    testAudio.volume = 0.5;
    testAudio.loop = true;
    testAudioRef.current = testAudio;

    // Listeners to bind active status indicator accurately
    const onPlay = () => setIsPlayingTest(true);
    const onPause = () => setIsPlayingTest(false);
    
    testAudio.addEventListener('play', onPlay);
    testAudio.addEventListener('pause', onPause);

    return () => {
      testAudio.removeEventListener('play', onPlay);
      testAudio.removeEventListener('pause', onPause);
      testAudio.pause();
      testAudio.src = '';
      testAudioRef.current = null;
    };
  }, []);

  // Categorize known output devices by description
  const getDeviceGroup = (label: string): string => {
    const l = label.toLowerCase();
    if (l.includes('default') || l.includes('communications') || l.includes('system')) {
      return 'System Default';
    }
    if (l.includes('headphone') || l.includes('headset') || l.includes('ear') || l.includes('phone') || l.includes('jack')) {
      return 'Headphones / Headset';
    }
    if (l.includes('bluetooth') || l.includes('wireless') || l.includes('airpod') || l.includes('buds')) {
      return 'Bluetooth Sound Output';
    }
    return 'Speakers / External Outputs';
  };

  // Discover and enumerate target output device entities
  const scanAudioDevices = useCallback(async (forcedUserConsent = false) => {
    if (!isSetSinkIdSupported) {
      setStatusState('not-supported');
      return;
    }

    setIsScanning(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        setStatusState('not-supported');
        return;
      }

      let deviceList = await navigator.mediaDevices.enumerateDevices();
      let outputList = deviceList.filter(d => d.kind === 'audiooutput');

      // Check if browser is masking hardware labels (empty length or empty text labels)
      const isMaskedOrHidden = outputList.length === 0 || outputList.every(d => !d.label || d.label.trim() === '');

      // Trigger temporary permission loop if requested or if we are empty and forced
      if (isMaskedOrHidden && forcedUserConsent) {
        try {
          // Ask for temporary mic authorization to unlock system speaker names
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          // CRITICAL: Immediately close sound stream so that browser recording indicator turns off!
          stream.getTracks().forEach(track => {
            track.stop();
            console.log('[Speaker Router] Microphone track successfully closed to preserve privacy.');
          });
          setPermissionDeclined(false);

          // Enumerate devices once more now that labels are unlocked
          deviceList = await navigator.mediaDevices.enumerateDevices();
          outputList = deviceList.filter(d => d.kind === 'audiooutput');
        } catch (mediaErr) {
          console.warn('[Speaker Router] Microphone permission declined, fallback to generic labels:', mediaErr);
          setPermissionDeclined(true);
          onAlert?.('Privacy mode active. Connected output streams will map using generic speaker IDs.', 'success');
        }
      }

      // Format audiooutput list with readable groups
      const parsedDevices: AudioOutputDevice[] = outputList.map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Speaker/Headphone (ID: ${device.deviceId.slice(0, 5)}...)`,
        group: getDeviceGroup(device.label)
      }));

      setDevices(parsedDevices);

      // Assess correct lifecycle block state
      const stillMasked = parsedDevices.length === 0 || parsedDevices.every(d => d.label.startsWith('Speaker/Headphone (ID:'));
      if (stillMasked && !forcedUserConsent && !permissionDeclined) {
        setStatusState('permission-required');
      } else {
        setStatusState('ready');
      }

      // Sync active state with the chosen hardware sink id if registered
      const savedDevice = localStorage.getItem('wavetune_output_device_id') || 'default';
      const isReal = parsedDevices.some(d => d.deviceId === savedDevice);
      if (isReal && savedDevice !== 'default') {
        setSelectedDeviceId(savedDevice);
      } else {
        setSelectedDeviceId('default');
      }

    } catch (err: any) {
      console.error('[Speaker Router] Failed to resolve media devices:', err);
      setStatusState('permission-required');
    } finally {
      setIsScanning(false);
    }
  }, [isSetSinkIdSupported, onAlert]);

  // Handle immediate physical device shift
  const handleDeviceShift = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem('wavetune_output_device_id', deviceId);

    // Apply routing to the active parent stream player
    const mainAudio = audioElementRef?.current;
    if (mainAudio && isSetSinkIdSupported) {
      try {
        await (mainAudio as any).setSinkId(deviceId);
        console.log(`[Speaker Router] Routed active main track feed directly to sink: ${deviceId}`);
      } catch (err: any) {
        console.warn(`[Speaker Router] setSinkId call failed on main audio elements:`, err);
      }
    }

    // Apply routing to local diagnostics play tester if active
    const testAudio = testAudioRef.current;
    if (testAudio && isSetSinkIdSupported) {
      try {
        await (testAudio as any).setSinkId(deviceId);
        console.log(`[Speaker Router] Routed local diagnostics sink to: ${deviceId}`);
      } catch (err: any) {
        console.warn(`[Speaker Router] setSinkId call failed on test audio stream:`, err);
      }
    }

    const matched = devices.find(d => d.deviceId === deviceId);
    const friendlyName = matched ? matched.label : 'Default Output Device';
    onAlert?.(`Sound output successfully routed to: ${friendlyName}`, 'success');
  };

  // Diagnostic play/pause control action
  const toggleDiagnosticsPlayback = async () => {
    const testAudio = testAudioRef.current;
    if (!testAudio) return;

    if (isPlayingTest) {
      testAudio.pause();
    } else {
      // Direct routing binding
      if (isSetSinkIdSupported && selectedDeviceId !== 'default') {
        try {
          await (testAudio as any).setSinkId(selectedDeviceId);
        } catch (err) {
          console.warn('[Speaker Router] Failed to bind local diagnostic sinkId:', err);
        }
      }

      // Start testing
      testAudio.play()
        .then(() => {
          onAlert?.('Diagnostics sound loop active on chosen speaker output hardware.', 'success');
        })
        .catch(err => {
          console.error('[Speaker Router] Playback gesture failed, please retry:', err);
          onAlert?.('Interactivity gesture required. Click play again to start tone.', 'error');
        });
    }
  };

  // Run initial discover sweep on startup
  useEffect(() => {
    scanAudioDevices();

    // Attach hardware device plug-and-play event listener
    if (typeof window !== 'undefined' && navigator.mediaDevices) {
      const handleHardwareMutation = () => {
        scanAudioDevices();
      };
      
      navigator.mediaDevices.addEventListener('devicechange', handleHardwareMutation);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleHardwareMutation);
      };
    }
  }, [scanAudioDevices]);

  // Group devices for listing layout
  const aggregatedGroups: Record<string, AudioOutputDevice[]> = {};
  devices.forEach(d => {
    if (!aggregatedGroups[d.group]) {
      aggregatedGroups[d.group] = [];
    }
    aggregatedGroups[d.group].push(d);
  });

  return (
    <div className={`p-4 md:p-5 rounded-2xl border transition-all text-left ${
      theme === 'light'
        ? 'bg-white border-neutral-200 text-neutral-800 shadow-sm'
        : 'bg-zinc-950 border-white/5 text-white shadow-xl shadow-black/40'
    }`}>
      {/* Widget Header bar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="space-y-0.5">
          <label className="text-[10px] font-mono font-bold uppercase tracking-widest text-pink-500 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 shrink-0 text-pink-500 animate-pulse" /> Sound Output Device Select
          </label>
          <span className="text-[10px] font-sans opacity-60 block">Manage & diagnose direct physical hardware speaker channels</span>
        </div>
        
        <button
          type="button"
          disabled={isScanning}
          onClick={() => scanAudioDevices(true)}
          className={`p-1.5 rounded-lg border transition-all ${
            theme === 'light'
              ? 'hover:bg-neutral-100 border-neutral-200 hover:border-neutral-300'
              : 'hover:bg-white/10 border-white/10 hover:border-white/20'
          } ${isScanning ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          title="Rescan system hardware connectors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-neutral-400 ${isScanning ? 'animate-spin text-pink-500' : ''}`} />
        </button>
      </div>

      {/* Lifecycle Status Indicators */}
      <div className="mb-4">
        {isSelfInsideIframe && (
          <div className="mb-3 p-3 rounded-xl border border-blue-500/15 bg-blue-500/10 text-blue-800 dark:text-blue-300 font-sans text-xs flex flex-col gap-1.5 shadow-sm">
            <p className="font-bold flex items-center gap-1.5 text-blue-900 dark:text-blue-200">
              🌐 Simulator Frame Active (Speaker Discovery Restricted)
            </p>
            <p className="text-[10px] font-mono leading-relaxed opacity-90">
              Your browser blocks direct output speaker listings and custom hardware routing (`setSinkId`) when running inside sandboxed simulator iframes.
            </p>
            <p className="text-[10px] font-sans font-bold text-pink-500 dark:text-pink-400">
              💡 Fix: Click the "Open App" (with an arrow) button in the top-right corner of AI Studio to launch this tool in its own tab, granting full hardware detection!
            </p>
          </div>
        )}

        {statusState === 'loading' && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-mono bg-neutral-100 dark:bg-white/5 opacity-80">
            <Loader2 className="w-4 h-4 animate-spin text-pink-500" />
            <span className="text-neutral-500 dark:text-neutral-400">Scanning audio hardware channels...</span>
          </div>
        )}

        {statusState === 'permission-required' && (
          <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-400 font-sans space-y-2">
            <div className="flex items-start gap-2.5">
              <Shield className="w-4 h-4 shrink-0 mt-0.5 text-amber-500 animate-bounce" />
              <div className="space-y-1">
                <p className="text-xs font-bold font-sans">Hardware Labels Locked (Permission Required)</p>
                <p className="text-[10px] font-mono leading-relaxed opacity-90">
                  Your browser hides precise brand names to safeguard privacy. Click authorization below to grant a quick microphone detection check; the mic line is closed immediately so no recording occurs.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => scanAudioDevices(true)}
              className="w-full text-center py-1.5 px-3 bg-amber-500 hover:bg-amber-600 active:scale-98 text-white rounded-lg text-[10px] font-mono font-bold tracking-wider uppercase transition-all"
            >
              🔓 Unlock Connected Brand Name Labels
            </button>
          </div>
        )}

        {statusState === 'ready' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Target Router: Ready {permissionDeclined ? '(Fallback Nodes)' : ''}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 dark:bg-emerald-500/10 font-bold uppercase">Supported</span>
            </div>
            {permissionDeclined && (
              <div className="p-2.5 rounded-lg text-[10px] font-mono leading-normal bg-neutral-100 dark:bg-zinc-900 border border-neutral-200 dark:border-white/5 opacity-80 text-neutral-500 dark:text-neutral-400">
                ⚠️ Brand names hidden (mic permission was bypassed or declined). You can still route active audio stream targets using the unique generic Speaker/Headphone IDs sorted below.
              </div>
            )}
          </div>
        )}

        {statusState === 'not-supported' && (
          <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400 font-sans">
            <div className="flex items-start gap-2.5">
              <AlertOctagon className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold leading-normal">Custom Device Shifting Not Supported</p>
                <p className="text-[9px] font-mono leading-relaxed opacity-80">
                  Your browser or this frame does not permit HTMLMediaElement.setSinkId(). Sound output routes will default automatically to your operative system settings.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Select Input Dropdown Container */}
      <div className="space-y-3">
        <div>
          <label className="text-[9px] font-mono uppercase tracking-wider text-neutral-400 mb-1.5 block">
            Selected Output Hardware Node
          </label>
          <div className="relative">
            <select
              value={selectedDeviceId}
              disabled={statusState === 'not-supported'}
              onChange={(e) => handleDeviceShift(e.target.value)}
              className={`w-full text-xs font-sans rounded-xl px-3 py-2.5 border transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-pink-500 disabled:opacity-40 disabled:cursor-not-allowed ${
                theme === 'light'
                  ? 'bg-neutral-50 hover:bg-neutral-100 border-neutral-300 text-neutral-800'
                  : 'bg-zinc-900 hover:bg-zinc-800/80 border-white/10 text-white'
              }`}
            >
              <option value="default" className="text-neutral-500">System Default (Operating System Settings)</option>
              {Object.entries(aggregatedGroups).map(([groupName, list]) => (
                <optgroup key={groupName} label={groupName} className="font-sans font-extrabold text-neutral-500 dark:text-neutral-400 mt-2">
                  {list.map(d => (
                    <option key={d.deviceId} value={d.deviceId} className="font-sans font-normal text-neutral-800 dark:text-neutral-200">
                      {d.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {/* Standard Playback Diagnostics Module Interface */}
        <div className={`p-3 rounded-xl border text-left ${
          theme === 'light'
            ? 'bg-neutral-50 border-neutral-200'
            : 'bg-zinc-900/50 border-white/5'
        }`}>
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              🔊 Speaker Hardware Diagnostics Player
            </span>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isPlayingTest ? 'bg-pink-500 animate-ping' : 'bg-neutral-400'}`} />
              <span className="text-[9px] font-mono text-neutral-400 uppercase">
                {isPlayingTest ? 'Active Stream' : 'Idle'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleDiagnosticsPlayback}
              className={`flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl font-bold font-sans text-xs transition-all cursor-pointer ${
                isPlayingTest 
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-md'
                  : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/10'
              }`}
            >
              {isPlayingTest ? (
                <>
                  <Pause className="w-3.5 h-3.5" /> Stop diagnostics tone
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" /> Play diagnostics test audio
                </>
              )}
            </button>

            <span className="text-[9px] font-sans opacity-70 leading-normal text-neutral-500 dark:text-neutral-400 flex-1">
              Press to stream chimes specifically to your target speaker selection. This verifies hardware isolation before starting full YouTube track casts.
            </span>
          </div>
        </div>

        {/* Explanatory browser routing notes */}
        <div className="text-[9px] font-mono opacity-60 leading-normal flex items-start gap-1.5 mt-2">
          <HelpCircle className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span>
            Hardware output binding (setSinkId) is fully standardized in modern browsers (Chrome, Edge, Opera, and chromium engines). If names are missing, make sure you aren't in a completely isolated sandboxed iframe block.
          </span>
        </div>
      </div>
    </div>
  );
}
