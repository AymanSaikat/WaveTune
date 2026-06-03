import React from 'react';
import { useAudioDevices } from '../hooks/useAudioDevices';
import { Volume2, Settings, HelpCircle, Shield, RefreshCw, Check } from 'lucide-react';

interface DeviceSelectorProps {
  audioElementRef?: React.RefObject<HTMLAudioElement | null>;
  theme: 'light' | 'dark';
  onAlert?: (msg: string, type: 'success' | 'error') => void;
}

export default function DeviceSelector({ audioElementRef, theme, onAlert }: DeviceSelectorProps) {
  const {
    devices,
    selectedDeviceId,
    permissionGranted,
    error,
    refreshDevices,
    requestPermissionAndRefresh,
    selectDevice,
    selectNativeOutputDevice,
  } = useAudioDevices();

  const handleDeviceChange = async (deviceId: string) => {
    const audioEl = audioElementRef?.current;
    try {
      await selectDevice(deviceId, audioEl);
      const matchedDevice = devices.find(d => d.deviceId === deviceId);
      const label = matchedDevice ? matchedDevice.label : 'Selected speaker';
      onAlert?.(`Successfully shifted sound output to: ${label}`, 'success');
    } catch (err: any) {
      onAlert?.(`Failed to select speaker: ${err?.message || err}`, 'error');
    }
  };

  const handleNativeDevicePick = async () => {
    const audioEl = audioElementRef?.current;
    try {
      const selectedLabel = await selectNativeOutputDevice(audioEl);
      onAlert?.(`Successfully shifted sound output to: ${selectedLabel}`, 'success');
    } catch (err: any) {
      onAlert?.(`Speaker selection cancelled or not supported: ${err?.message || err}`, 'error');
    }
  };

  const isChromeOrChromium = () => {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent.toLowerCase();
    return ua.includes('chrome') || ua.includes('chromium') || ua.includes('edg/');
  };

  const getDeviceGroup = (label: string): 'Headphones' | 'Speakers' | 'Bluetooth' | 'System Default' => {
    const l = label.toLowerCase();
    if (l.includes('default') || l.includes('communications') || l.includes('system')) {
      return 'System Default';
    }
    if (l.includes('headphone') || l.includes('headset') || l.includes('ear') || l.includes('phone') || l.includes('jack')) {
      return 'Headphones';
    }
    if (l.includes('bluetooth') || l.includes('wireless') || l.includes('airpod') || l.includes('buds')) {
      return 'Bluetooth';
    }
    return 'Speakers';
  };

  const groupedDevices = {
    'System Default': [] as typeof devices,
    'Headphones': [] as typeof devices,
    'Speakers': [] as typeof devices,
    'Bluetooth': [] as typeof devices,
  };

  devices.forEach(d => {
    const group = getDeviceGroup(d.label);
    groupedDevices[group].push(d);
  });

  return (
    <div className={`p-4 rounded-xl border text-left ${
      theme === 'light'
        ? 'bg-neutral-50/50 border-neutral-200 text-neutral-800'
        : 'bg-zinc-900/40 border-white/5 text-white'
    }`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <label className="text-xs font-mono font-bold uppercase tracking-wider text-pink-500 flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 shrink-0" /> Sound Output Device Select
        </label>
        
        <button
          type="button"
          onClick={refreshDevices}
          className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
          title="Scan for connected audio devices"
        >
          <RefreshCw className="w-3 h-3 text-neutral-400" />
        </button>
      </div>

      {error ? (
        <p className="text-[10px] text-red-500 font-mono mb-2">{error}</p>
      ) : null}

      {/* Main Select input or custom buttons */}
      <div className="space-y-2">
        <div className="relative">
          <select
            value={selectedDeviceId}
            onChange={(e) => handleDeviceChange(e.target.value)}
            className={`w-full text-xs font-sans rounded-lg px-3 py-2 border shadow-sm focus:outline-none focus:ring-1 focus:ring-pink-500 cursor-pointer ${
              theme === 'light'
                ? 'bg-white border-neutral-300 text-neutral-800'
                : 'bg-neutral-950 border-white/10 text-white'
            }`}
          >
            {devices.length === 0 ? (
              <option value="default">Default Device (System Default)</option>
            ) : (
              Object.entries(groupedDevices).map(([groupName, groupList]) => {
                if (groupList.length === 0) return null;
                return (
                  <optgroup key={groupName} label={groupName} className="font-sans font-bold text-neutral-500 dark:text-neutral-400">
                    {groupList.map((device) => (
                      <option key={device.deviceId} value={device.deviceId} className="font-sans font-normal text-neutral-800 dark:text-neutral-200">
                        {device.label}
                      </option>
                    ))}
                  </optgroup>
                );
              })
            )}
          </select>
        </div>

        {/* Modern Web Audio selectAudioOutput Native Selector Entry point */}
        <button
          type="button"
          onClick={handleNativeDevicePick}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 mt-2 bg-gradient-to-r from-pink-500/10 to-purple-600/10 border border-pink-500/20 text-pink-500 dark:text-pink-400 font-bold rounded-lg text-[10px] font-mono hover:bg-pink-500/20 transition-all cursor-pointer tracking-wider uppercase text-center"
        >
          🎯 Native Speaker Dialogue Prompt
        </button>

        {/* Informative advice for user regarding device labels & permissions */}
        {!permissionGranted && (
          <div className="text-[10px] font-mono leading-relaxed opacity-80 mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
            <span className="flex items-center gap-1 font-bold mb-0.5">
              <Shield className="w-3 h-3 shrink-0 text-amber-500" /> System labels are masked
            </span>
            <span>
              Your browser hides actual device names to preserve privacy. Click below to authorize speaker detection labels.
            </span>
            <button
              type="button"
              onClick={requestPermissionAndRefresh}
              className="mt-1.5 w-full text-center py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[9px] font-bold tracking-wider uppercase transition-colors"
            >
              Reveal Connected Speaker Names
            </button>
          </div>
        )}

        {/* If chromium browser compatibility check */}
        {!isChromeOrChromium() && (
          <p className="text-[9px] font-mono opacity-60 flex items-center gap-1 mt-1 text-neutral-500">
            <HelpCircle className="w-3 h-3 shrink-0 text-neutral-400" /> Output shifting (setSinkId) is fully supported in Chromium browsers (Chrome, Edge, Opera).
          </p>
        )}
      </div>
    </div>
  );
}
