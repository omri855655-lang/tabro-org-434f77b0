/**
 * iOS Safari Background Audio — uses a real hosted MP3 file
 * connected to the shared AudioContext so oscillators stay alive.
 * 
 * IMPORTANT: The silent audio element and its MediaElementSourceNode
 * are created ONCE and reused. We only pause/play — never destroy.
 */

import { unlockAudioContext } from "./iosAudioUnlock";

const SILENT_MP3_URL = "/silence.mp3";

let silentAudio: HTMLAudioElement | null = null;
let silentSource: MediaElementAudioSourceNode | null = null;
let isInitialized = false;

function ensureInitialized() {
  if (isInitialized) return;

  const ctx = unlockAudioContext();

  silentAudio = new Audio(SILENT_MP3_URL);
  silentAudio.loop = true;
  silentAudio.volume = 0.001;
  silentAudio.setAttribute("playsinline", "true");
  (silentAudio as any).playsInline = true;

  // Attach to DOM so iOS treats it as a real media element
  silentAudio.style.display = "none";
  document.body.appendChild(silentAudio);

  // Connect to the SHARED AudioContext ONCE — this is the key!
  // createMediaElementSource can only be called once per element
  silentSource = ctx.createMediaElementSource(silentAudio);
  silentSource.connect(ctx.destination);

  isInitialized = true;
}

export function startSilentAudio() {
  if (silentAudio && !silentAudio.paused) return;

  try {
    ensureInitialized();
  } catch (e) {
    console.warn("Silent audio init failed:", e);
    return;
  }

  silentAudio!.play().catch(() => {});

  // Register MediaSession so iOS treats this as real media
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Deeply — מוזיקת רקע",
      artist: "Tabro",
      artwork: [
        { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
      ],
    });

    navigator.mediaSession.setActionHandler("play", () => {
      silentAudio?.play().catch(() => {});
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      // intentionally do nothing — keep playing
    });

    navigator.mediaSession.setActionHandler("stop", () => {
      silentAudio?.pause();
    });
  }
}

export function stopSilentAudio() {
  // Only pause — do NOT destroy the element or the MediaElementSourceNode
  if (silentAudio) {
    silentAudio.pause();
  }
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = null;
  }
}

export function isSilentAudioActive(): boolean {
  return silentAudio !== null && !silentAudio.paused;
}
