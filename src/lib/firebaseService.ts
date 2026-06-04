import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  increment, 
  query, 
  where, 
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Track, PlaybackState, PairedDevice } from '../types';

// Initialize defaults for Playback and Config
export async function initializeFirebaseSchema() {
  try {
    const playRef = doc(db, 'playbackState', 'current');
    const playSnap = await getDoc(playRef);
    if (!playSnap.exists()) {
      await setDoc(playRef, {
        currentTrackId: null,
        status: 'stopped',
        progress: 0,
        volume: 75,
        activeDeviceId: null,
        activeStreamLimit: 'unlimited'
      });
    }

    const confRef = doc(db, 'playbackState', 'adminConfig');
    const confSnap = await getDoc(confRef);
    if (!confSnap.exists()) {
      await setDoc(confRef, {
        password: 'admin123'
      });
    }
  } catch (err) {
    console.error('Failed to bootstrap initial Firestore collections:', err);
  }
}

// 1. Subscribe to Queue (Real-time)
export function subscribeToQueue(onUpdate: (queue: Track[]) => void) {
  const collectionPath = 'queue';
  const q = collection(db, collectionPath);
  return onSnapshot(q, (snapshot) => {
    const tracks: Track[] = [];
    snapshot.forEach((doc) => {
      tracks.push(doc.data() as Track);
    });
    // Sort logic matching backend:
    // Sort by status ('playing' at top, 'queued' sorted by votes desc and addedAt inside, and 'played' at bottom sorted by playedAt desc)
    tracks.sort((a, b) => {
      const statusWeight = { playing: 0, queued: 1, paused: 2, played: 3 };
      const wa = statusWeight[a.status] ?? 4;
      const wb = statusWeight[b.status] ?? 4;
      if (wa !== wb) return wa - wb;
      
      if (a.status === 'queued') {
        if (b.votes !== a.votes) {
          return b.votes - a.votes;
        }
        return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
      }
      
      if (a.status === 'played') {
        const aPlayed = (a as any).playedAt ? new Date((a as any).playedAt).getTime() : new Date(a.addedAt).getTime();
        const bPlayed = (b as any).playedAt ? new Date((b as any).playedAt).getTime() : new Date(b.addedAt).getTime();
        return bPlayed - aPlayed;
      }
      
      return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
    });
    
    onUpdate(tracks);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, collectionPath);
  });
}

// 2. Subscribe to PlaybackState (Real-time)
export function subscribeToPlaybackState(onUpdate: (state: PlaybackState) => void) {
  const path = 'playbackState/current';
  return onSnapshot(doc(db, 'playbackState', 'current'), (snapshot) => {
    if (snapshot.exists()) {
      onUpdate(snapshot.data() as PlaybackState);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

// 3. Subscribe to Devices (Real-time)
export function subscribeToDevices(onUpdate: (devices: PairedDevice[]) => void) {
  const path = 'devices';
  return onSnapshot(collection(db, 'devices'), (snapshot) => {
    const list: PairedDevice[] = [];
    snapshot.forEach((doc) => {
      list.push(doc.data() as PairedDevice);
    });
    onUpdate(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

// 4. Submit a Track Song Request
export async function addQueueTrack(data: Omit<Track, 'id' | 'votes' | 'status' | 'addedAt'>) {
  const path = 'queue';
  const trackId = 'track-' + Math.random().toString(36).substring(2, 11);
  const newTrack: Track = {
    id: trackId,
    title: data.title,
    artist: data.artist,
    url: data.url,
    youtubeId: data.youtubeId,
    artworkUrl: data.artworkUrl,
    duration: data.duration,
    status: 'queued',
    requestedBy: data.requestedBy || 'Anonymous Guest',
    addedAt: new Date().toISOString(),
    votes: 1,
    originalName: data.originalName || data.title,
    originalArtist: data.originalArtist || data.artist,
    originalCover: data.originalCover || data.artworkUrl,
    originalLabel: data.originalLabel || 'Independent Record Label',
    previewUrl: data.previewUrl || ''
  };

  try {
    await setDoc(doc(db, 'queue', trackId), newTrack);
    console.log(`[Firestore] Track added to collaborative queue: ${newTrack.title}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${path}/${trackId}`);
  }
}

// 5. Upvote a Track
export async function voteQueueTrack(trackId: string, value: number) {
  const path = `queue/${trackId}`;
  try {
    const trackRef = doc(db, 'queue', trackId);
    const snap = await getDoc(trackRef);
    if (snap.exists()) {
      const currentVotes = snap.data().votes || 1;
      await updateDoc(trackRef, {
        votes: Math.max(1, currentVotes + value)
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// 6. Delete a Track
export async function deleteQueueTrack(trackId: string, playbackState: PlaybackState) {
  const path = `queue/${trackId}`;
  try {
    const isPlaying = playbackState.currentTrackId === trackId;
    await deleteDoc(doc(db, 'queue', trackId));
    
    if (isPlaying) {
      await updateDoc(doc(db, 'playbackState', 'current'), {
        currentTrackId: null,
        status: 'stopped',
        progress: 0
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 7. Clear entire collaborative Queue
export async function clearAllQueue() {
  try {
    // Reset PlaybackState
    await setDoc(doc(db, 'playbackState', 'current'), {
      currentTrackId: null,
      status: 'stopped',
      progress: 0,
      volume: 75,
      activeDeviceId: null
    });

    // Delete tracks in batches
    const tracksSnap = await getDocs(collection(db, 'queue'));
    const batch = writeBatch(db);
    tracksSnap.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log('[Firestore] Cleared collaborative musical queue database successfully.');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'queue');
  }
}

// 8. Reorder tracks manually (Host capability)
export async function reorderQueueTracks(orderedIds: string[], currentQueue: Track[]) {
  try {
    const batch = writeBatch(db);
    let index = 0;
    const queuedTracks = currentQueue.filter(t => t.status === 'queued');
    
    for (const id of orderedIds) {
      const track = queuedTracks.find(t => t.id === id);
      if (track) {
        // Adjust addedAt timestamp sequentially to simulate user sorted layout inside firestore
        const simulatedTime = new Date(Date.now() - (queuedTracks.length - index) * 1000).toISOString();
        const trackRef = doc(db, 'queue', id);
        batch.update(trackRef, { addedAt: simulatedTime });
        index++;
      }
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'queue');
  }
}

// 9. Playback control (Host Operations Console)
export async function triggerPlaybackControl(
  data: { action: 'play' | 'pause' | 'skip' | 'volume' | 'select_track'; targetTrackId?: string; value?: any },
  currentQueue: Track[],
  playbackState: PlaybackState
) {
  try {
    const playRef = doc(db, 'playbackState', 'current');
    
    if (data.action === 'select_track' && data.targetTrackId) {
      const batch = writeBatch(db);
      
      const currentPlaying = currentQueue.find(t => t.status === 'playing');
      if (currentPlaying) {
        batch.update(doc(db, 'queue', currentPlaying.id), {
          status: 'played',
          playedAt: new Date().toISOString()
        });
      }

      batch.update(doc(db, 'queue', data.targetTrackId), {
        status: 'playing'
      });

      batch.update(playRef, {
        currentTrackId: data.targetTrackId,
        status: 'playing',
        progress: 0
      });

      await batch.commit();
    } else if (data.action === 'play') {
      if (!playbackState.currentTrackId) {
        // Find top-voted queued song
        const activeQueue = currentQueue
          .filter(t => t.status === 'queued')
          .sort((a, b) => b.votes - a.votes || new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
        
        if (activeQueue.length > 0) {
          const first = activeQueue[0];
          const batch = writeBatch(db);
          batch.update(doc(db, 'queue', first.id), { status: 'playing' });
          batch.update(playRef, {
            currentTrackId: first.id,
            status: 'playing',
            progress: 0
          });
          await batch.commit();
        }
      } else {
        await updateDoc(playRef, { status: 'playing' });
      }
    } else if (data.action === 'pause') {
      await updateDoc(playRef, { status: 'paused' });
    } else if (data.action === 'volume') {
      await updateDoc(playRef, { volume: data.value });
    } else if (data.action === 'skip') {
      const batch = writeBatch(db);
      
      if (playbackState.currentTrackId) {
        batch.update(doc(db, 'queue', playbackState.currentTrackId), {
          status: 'played',
          playedAt: new Date().toISOString()
        });
      }

      const activeQueue = currentQueue
        .filter(t => t.status === 'queued')
        .sort((a, b) => b.votes - a.votes || new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
      
      if (activeQueue.length > 0) {
        const nextTrack = activeQueue[0];
        batch.update(doc(db, 'queue', nextTrack.id), { status: 'playing' });
        batch.update(playRef, {
          currentTrackId: nextTrack.id,
          status: 'playing',
          progress: 0
        });
      } else {
        batch.update(playRef, {
          currentTrackId: null,
          status: 'stopped',
          progress: 0
        });
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'playbackState/current');
  }
}

// 10. Device requests pairing code (Player view)
export async function registerDeviceForPairing(deviceId: string, deviceName: string) {
  try {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const newDevice: PairedDevice = {
      deviceId,
      deviceName: deviceName || 'Smart Display Screen',
      pairingCode: code,
      isOnline: true,
      connectedAt: new Date().toISOString(),
      socketId: 'firebase-virtual-socket'
    };
    await setDoc(doc(db, 'devices', deviceId), newDevice);
    return code;
  } catch (error) {
    return handleFirestoreError(error, OperationType.CREATE, `devices/${deviceId}`);
  }
}

// 11. Pair actions received in Host Operations pane
export async function verifyAndPairCode(code: string, adminName: string) {
  try {
    const q = query(collection(db, 'devices'), where('pairingCode', '==', code.trim()));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const matchDoc = snap.docs[0];
      const device = matchDoc.data() as PairedDevice;
      
      // Update playbackState
      await updateDoc(doc(db, 'playbackState', 'current'), {
        activeDeviceId: device.deviceId
      });
      return { success: true, device };
    }
    return { success: false, error: 'Pairing code expired or player offline.' };
  } catch (error) {
    return handleFirestoreError(error, OperationType.GET, 'devices');
  }
}

// 12. Active Player reports status feedback back periodically
export async function reportPlaybackProgress(progress: number, status: 'playing' | 'paused' | 'stopped') {
  try {
    await updateDoc(doc(db, 'playbackState', 'current'), {
      progress,
      status
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'playbackState/current');
  }
}

// 13. Track completed playing fully inside YouTube Player
export async function resolveCompletedTrack(trackId: string, currentQueue: Track[]) {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'queue', trackId), {
      status: 'played',
      playedAt: new Date().toISOString()
    });

    const activeQueue = currentQueue
      .filter(t => t.status === 'queued')
      .sort((a, b) => b.votes - a.votes || new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
    
    const playRef = doc(db, 'playbackState', 'current');
    if (activeQueue.length > 0) {
      const nextTrack = activeQueue[0];
      batch.update(doc(db, 'queue', nextTrack.id), { status: 'playing' });
      batch.update(playRef, {
        currentTrackId: nextTrack.id,
        status: 'playing',
        progress: 0
      });
    } else {
      batch.update(playRef, {
        currentTrackId: null,
        status: 'stopped',
        progress: 0
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'playbackState/current');
  }
}

// 14. Admin authentication local database validation
export async function validateAdminAccess(passwordInput: string): Promise<{ success: boolean; error?: string }> {
  try {
    const configSnap = await getDoc(doc(db, 'playbackState', 'adminConfig'));
    if (configSnap.exists()) {
      const correctSecret = configSnap.data().password || 'admin123';
      if (passwordInput === correctSecret) {
        return { success: true };
      }
    }
    return { success: false, error: 'Incorrect administrator passcode password' };
  } catch (error) {
    return { success: false, error: 'Network database could not be reached.' };
  }
}

// 15. Admin panel updates main passcode
export async function modifyAdminSecret(currentPasswordInput: string, newPasswordInput: string): Promise<{ success: boolean; error?: string }> {
  try {
    const configRef = doc(db, 'playbackState', 'adminConfig');
    const snap = await getDoc(configRef);
    const correctSecret = snap.exists() ? snap.data().password || 'admin123' : 'admin123';
    
    if (currentPasswordInput !== correctSecret) {
      return { success: false, error: 'Incorrect current session password.' };
    }
    if (!newPasswordInput || newPasswordInput.trim().length < 4) {
      return { success: false, error: 'New password must be at least 4 characters long.' };
    }
    
    await setDoc(configRef, { password: newPasswordInput.trim() }, { merge: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Cloud database security authentication write failed.' };
  }
}

// 16. Admin panel updates active stream limit
export async function updateActiveStreamLimit(limit: string) {
  try {
    const playRef = doc(db, 'playbackState', 'current');
    await updateDoc(playRef, {
      activeStreamLimit: limit
    });
    console.log(`[Firestore] Successfully synchronized active stream limit constraints: ${limit}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'playbackState/current');
  }
}
