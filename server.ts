import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3000;
const DATA_FILE = path.join(process.cwd(), "music_platform_data.json");

// Types duplicated for server-side typing
interface Track {
  id: string;
  title: string;
  artist: string;
  url: string;
  youtubeId: string;
  artworkUrl: string;
  duration: number;
  status: 'queued' | 'playing' | 'paused' | 'played';
  requestedBy: string;
  addedAt: string;
  votes: number;
  originalName?: string;
  originalArtist?: string;
  originalCover?: string;
  originalLabel?: string;
}

interface PlaybackState {
  currentTrackId: string | null;
  status: 'playing' | 'paused' | 'stopped';
  progress: number;
  volume: number;
  activeDeviceId: string | null;
}

interface PairedDevice {
  deviceId: string;
  deviceName: string;
  pairingCode: string;
  socketId: string | null;
  connectedAt: string;
  isOnline: boolean;
}

// Initial Data
let queue: Track[] = [
  {
    id: "init-1",
    title: "Blinding Lights",
    artist: "The Weeknd",
    url: "https://www.youtube.com/watch?v=4NRXx6U8ABQ",
    youtubeId: "4NRXx6U8ABQ",
    artworkUrl: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=600",
    duration: 200,
    status: "queued",
    requestedBy: "MuseSync System",
    addedAt: new Date(Date.now() - 600000).toISOString(),
    votes: 3
  },
  {
    id: "init-2",
    title: "Bohemian Rhapsody",
    artist: "Queen",
    url: "https://www.youtube.com/watch?v=fJ9rUzIMcZQ",
    youtubeId: "fJ9rUzIMcZQ",
    artworkUrl: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?q=80&w=600",
    duration: 354,
    status: "queued",
    requestedBy: "Retro Lover",
    addedAt: new Date(Date.now() - 300000).toISOString(),
    votes: 1
  }
];

let playbackState: PlaybackState = {
  currentTrackId: null,
  status: 'stopped',
  progress: 0,
  volume: 75,
  activeDeviceId: null
};

let devices: PairedDevice[] = [];
let adminPassword = "admin123";

// Load persisted state if exists
function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      if (parsed.queue) queue = parsed.queue;
      if (parsed.playbackState) playbackState = parsed.playbackState;
      if (parsed.devices) devices = parsed.devices.map((d: any) => ({ ...d, socketId: null, isOnline: false }));
      if (parsed.adminPassword) adminPassword = parsed.adminPassword;
      console.log("Loaded persisted state successfully.");
    }
  } catch (err) {
    console.error("Error reading queue from storage:", err);
  }
}

// Save persisted state
function saveState() {
  try {
    const data = { queue, playbackState, devices, adminPassword };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving queue to storage:", err);
  }
}

loadState();

// Initialize Gemini SDK safely
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini API initialized successfully in full-stack backend.");
  } catch (e) {
    console.error("Failed to initialize Gemini Client:", e);
  }
} else {
  console.log("No GEMINI_API_KEY found. Music search resolves will run with matching fallbacks.");
}

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  next();
});

// Helper for Track resolution
// Helper to search YouTube for a query and find the first videoId
async function searchYoutubeForVideoId(searchStr: string): Promise<string> {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchStr)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!response.ok) return "dQw4w9WgXcQ";
    const htmlText = await response.text();
    
    // Attempt pattern matches
    const jsonMatch = htmlText.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
    if (jsonMatch && jsonMatch[1]) {
      return jsonMatch[1];
    }
    
    const watchMatch = htmlText.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch && watchMatch[1]) {
      return watchMatch[1];
    }
  } catch (err) {
    console.error("YouTube scraper failure:", err);
  }
  return "dQw4w9WgXcQ"; // ultimate fallback
}

// Helper for Track resolution using iTunes, oEmbed metadata parsing, and active YouTube audio pairing
async function resolveTrackDetails(searchQuery: string): Promise<{
  title: string;
  artist: string;
  youtubeId: string;
  artworkUrl: string;
  duration: number;
  originalName: string;
  originalArtist: string;
  originalCover: string;
  originalLabel: string;
  previewUrl?: string;
}> {
  const queryClean = searchQuery.trim();
  const lowerQuery = queryClean.toLowerCase();
  
  const isUrl = queryClean.startsWith("http://") || queryClean.startsWith("https://");

  // A. URL PERSISTENCE & OEMBED PARSING ENGINE
  if (isUrl) {
    // 1. YouTube oEmbed
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
    const ytMatch = queryClean.match(ytRegex);

    if (ytMatch && ytMatch[1]) {
      const youtubeId = ytMatch[1];
      let title = "YouTube Video Track";
      let artist = "YouTube Creator";
      let artworkUrl = `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
      let label = "YouTube Direct Stream";
      let duration = 210;

      try {
        const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(queryClean)}&format=json`;
        const res = await fetch(oEmbedUrl);
        if (res.ok) {
          const data = await res.json() as any;
          title = data.title || title;
          artist = data.author_name || artist;
          artworkUrl = data.thumbnail_url || artworkUrl;
        }
      } catch (err) {
        console.error("YouTube oEmbed fetch error:", err);
      }

      let previewUrl = "";

      // Also try to find song specific details if the title has artist info
      try {
        const cleanTerm = title.replace(/official|video|audio|lyrics|hd|1080p|4k/gi, "").trim();
        const iTunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanTerm)}&entity=song&limit=1`);
        if (iTunesRes.ok) {
          const data = await iTunesRes.json() as any;
          if (data.results && data.results.length > 0) {
            const song = data.results[0];
            title = song.trackName;
            artist = song.artistName;
            duration = Math.round(song.trackTimeMillis / 1000);
            artworkUrl = song.artworkUrl100 ? song.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg') : artworkUrl;
            label = song.collectionName || label;
            if (song.previewUrl) {
              previewUrl = song.previewUrl;
            }
          }
        }
      } catch (e) {
        // ignore
      }

      return {
        title,
        artist,
        youtubeId,
        artworkUrl,
        duration,
        originalName: title,
        originalArtist: artist,
        originalCover: artworkUrl,
        originalLabel: label,
        previewUrl: previewUrl || undefined
      };
    }

    // 2. SoundCloud oEmbed
    if (lowerQuery.includes("soundcloud.com")) {
      let title = "SoundCloud Song";
      let artist = "SoundCloud Artist";
      let artworkUrl = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600";
      let duration = 180;
      let label = "SoundCloud Live Records";

      try {
        const oEmbedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(queryClean)}`;
        const res = await fetch(oEmbedUrl);
        if (res.ok) {
          const data = await res.json() as any;
          title = data.title || title;
          artist = data.author_name || artist;
          artworkUrl = data.thumbnail_url || artworkUrl;
        }
      } catch (err) {
        console.error("SoundCloud oEmbed error:", err);
      }

      // Automatically pair SoundCloud track with live playable YouTube video feed
      const matchedYtId = await searchYoutubeForVideoId(`${artist} - ${title} audio`);

      return {
        title,
        artist,
        youtubeId: matchedYtId,
        artworkUrl,
        duration,
        originalName: title,
        originalArtist: artist,
        originalCover: artworkUrl,
        originalLabel: label
      };
    }

    // 3. Spotify oEmbed
    if (lowerQuery.includes("spotify.com")) {
      let title = "Spotify Song";
      let artist = "Spotify Creator";
      let artworkUrl = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600";
      let duration = 195;
      let label = "Spotify Broadcast Stream";

      try {
        const oEmbedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(queryClean)}`;
        const res = await fetch(oEmbedUrl);
        if (res.ok) {
          const data = await res.json() as any;
          if (data.title) {
            const parts = data.title.split(" by ");
            if (parts.length > 1) {
              title = parts[0];
              artist = parts[1];
            } else {
              title = data.title;
            }
          }
          if (data.thumbnail_url) artworkUrl = data.thumbnail_url;
        }
      } catch (err) {
        console.error("Spotify oEmbed error:", err);
      }

      // Convert Spotify reference into a playable stream matched dynamically on YouTube
      const matchedYtId = await searchYoutubeForVideoId(`${artist} - ${title} audio`);

      return {
        title,
        artist,
        youtubeId: matchedYtId,
        artworkUrl,
        duration,
        originalName: title,
        originalArtist: artist,
        originalCover: artworkUrl,
        originalLabel: label
      };
    }

    // 4. Generic Links (MP3 directly / URLs)
    let titleFallback = "Web Stream Asset";
    try {
      const u = new URL(queryClean);
      const parsedPath = u.pathname.split("/").filter(Boolean);
      if (parsedPath.length > 0) {
        const lastPart = decodeURIComponent(parsedPath[parsedPath.length - 1]);
        titleFallback = lastPart.replace(/[-_]/g, " ").replace(/\.[a-zA-Z0-9]+$/, "");
      }
    } catch {}

    const matchedYtId = await searchYoutubeForVideoId(titleFallback);
    const coverUrl = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600";

    return {
      title: titleFallback,
      artist: "Internet Player",
      youtubeId: matchedYtId,
      artworkUrl: coverUrl,
      duration: 180,
      originalName: titleFallback,
      originalArtist: "Internet Player",
      originalCover: coverUrl,
      originalLabel: "Public Link Stream"
    };
  }

  // B. KEYWORD SEARCH ENGAGEMENT ENGINE
  // Check iTunes Search API for precise cover art + tags
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(queryClean)}&entity=song&limit=1`;
    const itunesRes = await fetch(itunesUrl);
    if (itunesRes.ok) {
      const data = await itunesRes.json() as any;
      if (data.results && data.results.length > 0) {
        const info = data.results[0];
        const title = info.trackName;
        const artist = info.artistName;
        const artworkUrl = info.artworkUrl100 ? info.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg') : "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600";
        const duration = Math.round(info.trackTimeMillis / 1000) || 180;
        const recordLabel = info.collectionName || info.primaryGenreName || "Independent Label";

        // Query YouTube dynamically for this track name and artist audio
        const matchedYtId = await searchYoutubeForVideoId(`${artist} ${title} audio`);
        
        return {
          title,
          artist,
          youtubeId: matchedYtId,
          artworkUrl,
          duration,
          originalName: title,
          originalArtist: artist,
          originalCover: artworkUrl,
          originalLabel: recordLabel,
          previewUrl: info.previewUrl || undefined
        };
      }
    }
  } catch (err) {
    console.error("iTunes Search API search failure, falling back to YouTube direct matching:", err);
  }

  // Local Offline Searches (Very robust static matcher)
  const indexMatches: any[] = [
    { keys: ["roll", "click", "rick", "astley"], title: "Never Gonna Give You Up", artist: "Rick Astley", youtubeId: "dQw4w9WgXcQ", duration: 212, label: "RCA Records", artworkUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600" },
    { keys: ["bohemian", "queen", "rhapsody"], title: "Bohemian Rhapsody", artist: "Queen", youtubeId: "fJ9rUzIMcZQ", duration: 354, label: "EMI Records", artworkUrl: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?q=80&w=600" },
    { keys: ["blind", "weeknd", "lights"], title: "Blinding Lights", artist: "The Weeknd", youtubeId: "4NRXx6U8ABQ", duration: 200, label: "XO / Republic Records", artworkUrl: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=600" },
    { keys: ["lucky", "punk", "daft"], title: "Get Lucky", artist: "Daft Punk ft. Pharrell Williams", youtubeId: "5NV6Rdv1a3I", duration: 248, label: "Columbia Records", artworkUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600" },
    { keys: ["stay", "kid", "laroi", "bieber"], title: "STAY", artist: "The Kid LAROI & Justin Bieber", youtubeId: "kTJczUoc26U", duration: 141, label: "Grade A / Columbia Records", artworkUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600" },
    { keys: ["shape", "sheeran", "of you"], title: "Shape of You", artist: "Ed Sheeran", youtubeId: "JGwWNGJdvx8", duration: 240, label: "Asylum / Atlantic Records", artworkUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600" }
  ];

  for (const match of indexMatches) {
    if (match.keys.some(k => lowerQuery.includes(k))) {
      return {
        title: match.title,
        artist: match.artist,
        youtubeId: match.youtubeId,
        artworkUrl: match.artworkUrl,
        duration: match.duration,
        originalName: match.title,
        originalArtist: match.artist,
        originalCover: match.artworkUrl,
        originalLabel: match.label
      };
    }
  }

  // Direct YouTube scraper for queries that didn't match iTunes
  const parsedTitle = queryClean.split(" - ")[1] || queryClean;
  const parsedArtist = queryClean.split(" - ")[0] || "Requested Music";
  const coverUrl = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600";
  const scrapId = await searchYoutubeForVideoId(queryClean);
  
  return {
    title: parsedTitle,
    artist: parsedArtist,
    youtubeId: scrapId,
    artworkUrl: coverUrl,
    duration: 180,
    originalName: parsedTitle,
    originalArtist: parsedArtist,
    originalCover: coverUrl,
    originalLabel: "Independent Record Label"
  };
}

// REST Web Endpoints
app.get("/api/queue", (req, res) => {
  res.json({ queue, playbackState });
});

app.get("/api/admin/history", (req, res) => {
  const playedTracks = queue.filter(t => t.status === 'played');
  playedTracks.sort((a, b) => {
    const aTime = (a as any).playedAt ? new Date((a as any).playedAt).getTime() : new Date(a.addedAt).getTime();
    const bTime = (b as any).playedAt ? new Date((b as any).playedAt).getTime() : new Date(b.addedAt).getTime();
    return bTime - aTime;
  });
  const historyLimit = playedTracks.slice(0, 20);
  res.json({ history: historyLimit });
});

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  const adminSecret = process.env.ADMIN_PASSWORD || adminPassword;
  if (password === adminSecret) {
    res.json({ success: true, token: "sonicstream-admin-authenticated-token" });
  } else {
    res.status(401).json({ success: false, error: "Incorrect admin password" });
  }
});

app.post("/api/admin/change-password", (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const adminSecret = process.env.ADMIN_PASSWORD || adminPassword;

  if (currentPassword !== adminSecret) {
    return res.status(400).json({ error: "Incorrect current session password." });
  }

  if (!newPassword || newPassword.trim().length < 4) {
    return res.status(400).json({ error: "New password must be at least 4 characters long." });
  }

  adminPassword = newPassword.trim();
  saveState();
  res.json({ success: true, message: "Host security session password modified successfully." });
});

app.post("/api/resolve", async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }
  try {
    const details = await resolveTrackDetails(query);
    res.json(details);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to resolve song details" });
  }
});

// Socket.io Real-Time Pipeline
io.on("connection", (socket) => {
  console.log(`Socket joined: ${socket.id}`);

  // Send current state on connection
  socket.emit("queue_update", queue);
  socket.emit("playback_state_update", playbackState);
  socket.emit("devices_update", devices);

  // Connection Bridge Roles
  socket.on("join_session", (data: { role: 'user' | 'admin' | 'player'; deviceId?: string; deviceName?: string }) => {
    socket.data.role = data.role;
    
    if (data.role === 'player' && data.deviceId) {
      socket.data.deviceId = data.deviceId;
      // Re-link playing device socket ID on reconnection
      const dIndex = devices.findIndex(d => d.deviceId === data.deviceId);
      if (dIndex !== -1) {
        devices[dIndex].socketId = socket.id;
        devices[dIndex].isOnline = true;
        if (data.deviceName) devices[dIndex].deviceName = data.deviceName;
        
        // Notify others
        io.emit("devices_update", devices);
      }
    }
  });

  // Request code creation for Device Bridge
  socket.on("request_pairing_code", (data: { deviceId: string; deviceName: string }) => {
    // Generate simple 4-digit code
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Remove if there is stale device with same deviceId
    devices = devices.filter(d => d.deviceId !== data.deviceId);

    const newDevice: PairedDevice = {
      deviceId: data.deviceId,
      deviceName: data.deviceName || "Smart Display",
      pairingCode: code,
      socketId: socket.id,
      connectedAt: new Date().toISOString(),
      isOnline: true
    };

    devices.push(newDevice);
    saveState();

    socket.data.role = 'player';
    socket.data.deviceId = data.deviceId;

    socket.emit("pairing_code_assigned", code);
    io.emit("devices_update", devices);
    console.log(`Registered device [${newDevice.deviceName}] with code ${code}`);
  });

  // Pair Action received from Admin Panel
  socket.on("pair_device", (data: { code: string; adminName: string }, callback) => {
    const matchedDevice = devices.find(d => d.pairingCode === data.code && d.isOnline);
    if (matchedDevice) {
      // Connect!
      playbackState.activeDeviceId = matchedDevice.deviceId;
      saveState();

      // Tell matching player socket they are paired successfully
      if (matchedDevice.socketId) {
        io.to(matchedDevice.socketId).emit("paired_confirmed", {
          pairedBy: data.adminName
        });
      }

      callback({ success: true, device: matchedDevice });
      
      io.emit("playback_state_update", playbackState);
      io.emit("devices_update", devices);
    } else {
      callback({ success: false, error: "Pairing code expired or player offline." });
    }
  });

  // Music Request Submissions
  socket.on("add_request", (data: { 
    title: string; 
    artist: string; 
    url: string; 
    youtubeId: string; 
    artworkUrl: string; 
    duration: number; 
    requestedBy: string;
    originalName?: string;
    originalArtist?: string;
    originalCover?: string;
    originalLabel?: string;
  }) => {
    const newTrack: Track = {
      id: "track-" + Math.random().toString(36).substr(2, 9),
      title: data.title,
      artist: data.artist,
      url: data.url,
      youtubeId: data.youtubeId,
      artworkUrl: data.artworkUrl,
      duration: data.duration,
      status: "queued",
      requestedBy: data.requestedBy || "Anonymous Guest",
      addedAt: new Date().toISOString(),
      votes: 1,
      originalName: data.originalName || data.title,
      originalArtist: data.originalArtist || data.artist,
      originalCover: data.originalCover || data.artworkUrl,
      originalLabel: data.originalLabel || "Independent Record Label"
    };

    queue.push(newTrack);
    saveState();

    io.emit("queue_update", queue);
    console.log(`Add track: ${newTrack.title} by ${newTrack.artist}`);
  });

  // Vote Song
  socket.on("vote_request", (data: { id: string; increment: number }) => {
    const track = queue.find(t => t.id === data.id);
    if (track) {
      track.votes = Math.max(1, track.votes + data.increment);
      saveState();
      io.emit("queue_update", queue);
    }
  });

  // Queue re-sorting / drag-and-drop state syncing
  socket.on("reorder_queue", (reorderedTrackIds: string[]) => {
    // Reorder tracks that are queued by matching user's exact order
    const completedTracks = queue.filter(t => t.status !== 'queued');
    const remainingQueued = queue.filter(t => t.status === 'queued');

    const newlyOrderedQueue: Track[] = [];

    // Map correct items in specified rank order
    reorderedTrackIds.forEach(id => {
      const match = remainingQueued.find(t => t.id === id);
      if (match) newlyOrderedQueue.push(match);
    });

    // Match index items missing in checklist
    remainingQueued.forEach(item => {
      if (!newlyOrderedQueue.some(q => q.id === item.id)) {
        newlyOrderedQueue.push(item);
      }
    });

    queue = [...completedTracks, ...newlyOrderedQueue];
    saveState();

    io.emit("queue_update", queue);
  });

  // Playback Operations Manager
  socket.on("playback_control", (data: { action: 'play' | 'pause' | 'skip' | 'volume' | 'select_track'; targetTrackId?: string; value?: any }) => {
    console.log(`Received playback control command: ${data.action}`, data);

    if (data.action === 'select_track' && data.targetTrackId) {
      // Pick specific song
      const currentPlaying = queue.find(t => t.status === 'playing');
      if (currentPlaying) {
        currentPlaying.status = 'played';
        (currentPlaying as any).playedAt = new Date().toISOString();
      }

      const nextTrack = queue.find(t => t.id === data.targetTrackId);
      if (nextTrack) {
        nextTrack.status = 'playing';
        playbackState.currentTrackId = nextTrack.id;
        playbackState.status = 'playing';
        playbackState.progress = 0;
      }
    } else if (data.action === 'play') {
      if (!playbackState.currentTrackId) {
        // Find top-voted queued song
        const activeQueue = queue
          .filter(t => t.status === 'queued')
          .sort((a, b) => b.votes - a.votes || new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
        
        if (activeQueue.length > 0) {
          const first = activeQueue[0];
          first.status = 'playing';
          playbackState.currentTrackId = first.id;
          playbackState.status = 'playing';
          playbackState.progress = 0;
        }
      } else {
        playbackState.status = 'playing';
      }
    } else if (data.action === 'pause') {
      playbackState.status = 'paused';
    } else if (data.action === 'volume') {
      playbackState.volume = data.value;
    } else if (data.action === 'skip') {
      // Mark current as played
      if (playbackState.currentTrackId) {
        const cur = queue.find(t => t.id === playbackState.currentTrackId);
        if (cur) {
          cur.status = 'played';
          (cur as any).playedAt = new Date().toISOString();
        }
      }

      // Next
      const activeQueue = queue
        .filter(t => t.status === 'queued')
        .sort((a, b) => b.votes - a.votes || new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
      
      if (activeQueue.length > 0) {
        const nextTrack = activeQueue[0];
        nextTrack.status = 'playing';
        playbackState.currentTrackId = nextTrack.id;
        playbackState.status = 'playing';
        playbackState.progress = 0;
      } else {
        playbackState.currentTrackId = null;
        playbackState.status = 'stopped';
        playbackState.progress = 0;
      }
    }

    saveState();

    // Broadcast update
    io.emit("playback_state_update", playbackState);
    io.emit("queue_update", queue);

    // Pipe command to Paired Device(s)
    if (playbackState.activeDeviceId) {
      const activeDev = devices.find(d => d.deviceId === playbackState.activeDeviceId && d.isOnline);
      if (activeDev && activeDev.socketId) {
        let activeTrackObj = null;
        if (playbackState.currentTrackId) {
          activeTrackObj = queue.find(t => t.id === playbackState.currentTrackId) || null;
        }

        io.to(activeDev.socketId).emit("device_playback_command", {
          action: data.action,
          track: activeTrackObj,
          volume: playbackState.volume,
          status: playbackState.status
        });
      }
    }
  });

  // Periodic Playback Position feedback from Active Player Bridge
  socket.on("player_status_feedback", (data: { progress: number; duration: number; status: 'playing' | 'paused' | 'stopped' }) => {
    playbackState.progress = data.progress;
    if (playbackState.status !== data.status) {
      playbackState.status = data.status;
    }
    socket.broadcast.emit("playback_state_update", playbackState);
  });

  // Track finished playing fully inside YouTube Player
  socket.on("player_track_finished", (data: { trackId: string }) => {
    console.log(`Playback device reported track completed: ${data.trackId}`);
    
    const track = queue.find(t => t.id === data.trackId);
    if (track) {
      track.status = 'played';
      (track as any).playedAt = new Date().toISOString();
    }

    // Auto-advance
    const activeQueue = queue
      .filter(t => t.status === 'queued')
      .sort((a, b) => b.votes - a.votes || new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());
    
    if (activeQueue.length > 0) {
      const nextTrack = activeQueue[0];
      nextTrack.status = 'playing';
      playbackState.currentTrackId = nextTrack.id;
      playbackState.status = 'playing';
      playbackState.progress = 0;
    } else {
      playbackState.currentTrackId = null;
      playbackState.status = 'stopped';
      playbackState.progress = 0;
    }

    saveState();
    
    io.emit("queue_update", queue);
    io.emit("playback_state_update", playbackState);

    // Instruction to the player device
    if (playbackState.activeDeviceId) {
      const activeDev = devices.find(d => d.deviceId === playbackState.activeDeviceId && d.isOnline);
      if (activeDev && activeDev.socketId) {
        let nextTrackObj = null;
        if (playbackState.currentTrackId) {
          nextTrackObj = queue.find(t => t.id === playbackState.currentTrackId) || null;
        }

        io.to(activeDev.socketId).emit("device_playback_command", {
          action: 'play',
          track: nextTrackObj,
          volume: playbackState.volume,
          status: playbackState.status
        });
      }
    }
  });

  // Admin delete requested song
  socket.on("delete_track", (trackId: string) => {
    const isPlaying = playbackState.currentTrackId === trackId;
    
    // Remove or set played
    queue = queue.filter(t => t.id !== trackId);
    
    if (isPlaying) {
      playbackState.currentTrackId = null;
      playbackState.status = 'stopped';
      playbackState.progress = 0;
    }

    saveState();
    
    io.emit("queue_update", queue);
    io.emit("playback_state_update", playbackState);

    // Stop active device
    if (isPlaying && playbackState.activeDeviceId) {
      const activeDev = devices.find(d => d.deviceId === playbackState.activeDeviceId && d.isOnline);
      if (activeDev && activeDev.socketId) {
        io.to(activeDev.socketId).emit("device_playback_command", {
          action: 'pause',
          track: null,
          volume: playbackState.volume,
          status: 'stopped'
        });
      }
    }
  });

  // Admin clear/purge entire request queue
  socket.on("clear_queue", () => {
    queue = [];
    playbackState.currentTrackId = null;
    playbackState.status = 'stopped';
    playbackState.progress = 0;
    saveState();
    
    io.emit("queue_update", queue);
    io.emit("playback_state_update", playbackState);

    // Pause player output
    if (playbackState.activeDeviceId) {
      const activeDev = devices.find(d => d.deviceId === playbackState.activeDeviceId && d.isOnline);
      if (activeDev && activeDev.socketId) {
        io.to(activeDev.socketId).emit("device_playback_command", {
          action: 'pause',
          track: null,
          volume: playbackState.volume,
          status: 'stopped'
        });
      }
    }
  });

  // Socket Disconnection
  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
    
    // Flag paired playing device offline if disconnected
    const dev = devices.find(d => d.socketId === socket.id);
    if (dev) {
      dev.isOnline = false;
      dev.socketId = null;
      io.emit("devices_update", devices);
    }
  });
});

// Serve static build or delegate to Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Serving application via Vite integrated middleware.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production dist files.");
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is booted at http://0.0.0.0:${PORT}`);
  });
}

startServer();
