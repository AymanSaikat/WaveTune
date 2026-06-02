import { useState, useEffect } from 'react';

export function useSessionTimer() {
  const [sessionSeconds, setSessionSeconds] = useState(0);

  useEffect(() => {
    // Check for an existing session start timestamp, or create a new one now.
    const key = 'wavetune_session_start_time';
    let startTimeStr = sessionStorage.getItem(key);
    
    if (!startTimeStr) {
      startTimeStr = Date.now().toString();
      sessionStorage.setItem(key, startTimeStr);
    }
    
    const startTime = parseInt(startTimeStr, 10);

    const updateTimer = () => {
      const elapsedMs = Date.now() - startTime;
      setSessionSeconds(Math.max(0, Math.floor(elapsedMs / 1000)));
    };

    // Initial update
    updateTimer();

    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  return {
    seconds: sessionSeconds,
    formattedDuration: formatDuration(sessionSeconds)
  };
}
