import { useState, useEffect, useCallback } from 'react';

export interface AudioOutputDevice {
  deviceId: string;
  label: string;
}

export function useAudioDevices() {
  const [devices, setDevices] = useState<AudioOutputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => {
    return localStorage.getItem('wavetune_output_device_id') || 'default';
  });
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        throw new Error('Media Devices API not supported in this browser.');
      }

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const outputDevices = allDevices
        .filter((device) => device.kind === 'audiooutput')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Speaker/Headphone (${device.deviceId.slice(0, 5)}...)`,
        }));

      setDevices(outputDevices);
    } catch (err: any) {
      console.error('Failed to enumerate audio output devices:', err);
      setError(err?.message || 'Failed to list audio devices');
    }
  }, []);

  const requestPermissionAndRefresh = useCallback(async () => {
    try {
      // 1. Request microphone permission to expose hardware speaker labels
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Immediately close the stream tracks to avoid keeping the microphone indicator active
        stream.getTracks().forEach((track) => track.stop());
        setPermissionGranted(true);
      }
    } catch (err: any) {
      console.warn('Microphone permission request declined or failed. Labels might be empty:', err);
    }
    // Refresh list of speakers regardless
    await refreshDevices();
  }, [refreshDevices]);

  // Hook into live plug/unplug events
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.mediaDevices) return;

    // Run initial scan
    refreshDevices();

    const handleDeviceChange = () => {
      refreshDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [refreshDevices]);

  const selectDevice = useCallback(async (deviceId: string, audioElement?: HTMLAudioElement | null) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem('wavetune_output_device_id', deviceId);

    if (audioElement) {
      try {
        if ('setSinkId' in audioElement) {
          await (audioElement as any).setSinkId(deviceId);
          console.log(`Audio output successfully set to device: ${deviceId}`);
        } else {
          console.warn('setSinkId is not supported by your browser or layout.');
        }
      } catch (err: any) {
        console.error('Failed to set speaker output sink ID:', err);
        throw err;
      }
    }
  }, []);

  return {
    devices,
    selectedDeviceId,
    permissionGranted,
    error,
    refreshDevices,
    requestPermissionAndRefresh,
    selectDevice,
  };
}
