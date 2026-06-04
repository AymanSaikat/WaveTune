export interface Track {
  id: string;
  title: string;
  artist: string;
  url: string;
  youtubeId: string;
  artworkUrl: string;
  duration: number; // in seconds
  status: 'queued' | 'playing' | 'paused' | 'played';
  requestedBy: string;
  addedAt: string;
  votes: number;
  originalName?: string;
  originalArtist?: string;
  originalCover?: string;
  originalLabel?: string;
  previewUrl?: string;
}

export interface PlaybackState {
  currentTrackId: string | null;
  status: 'playing' | 'paused' | 'stopped';
  progress: number; // in seconds
  volume: number; // 0 to 100
  activeDeviceId: string | null;
  activeStreamLimit?: string;
}

export interface PairedDevice {
  deviceId: string;
  deviceName: string;
  pairingCode: string;
  socketId: string | null;
  connectedAt: string;
  isOnline: boolean;
}
