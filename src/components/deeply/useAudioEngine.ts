import { useState, useCallback, useRef, useEffect } from "react";
import { AudioPreset, AUDIO_PRESETS } from "./audioPresets";
import { startSilentAudio, stopSilentAudio } from "./iosSilentAudio";
import { unlockAudioContext } from "./iosAudioUnlock";
import { renderPresetToBlob } from "./renderPresetToAudio";

// Quick lookup for preset names by id
const PRESET_NAME_MAP: Record<string, string> = {};
AUDIO_PRESETS.forEach(p => { PRESET_NAME_MAP[p.id] = p.nameHe || p.name; });

/**
 * Audio engine that pre-renders presets to WAV blobs and plays them
 * through a real <audio> element. This is critical for iOS background
 * playback — iOS keeps <audio> elements alive but suspends Web Audio
 * API oscillators when the app goes to background.
 */
export function useAudioEngine() {
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const isPlayingRef = useRef(false);

  const stopAudio = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = "";
      audioElRef.current.remove();
      audioElRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    stopSilentAudio();
    setIsPlaying(false);
    setIsRendering(false);
    isPlayingRef.current = false;
  }, []);

  const playPreset = useCallback(async (preset: AudioPreset) => {
    stopAudio();
    setIsRendering(true);
    setActivePresetId(preset.id);

    try {
      // Unlock audio context on user gesture (before async work)
      unlockAudioContext();
      startSilentAudio();

      // Render preset to a WAV blob (15 min)
      const blobUrl = await renderPresetToBlob(preset);
      blobUrlRef.current = blobUrl;

      // Create a real <audio> element — iOS keeps these alive in background
      const audio = new Audio(blobUrl);
      audio.loop = true;
      audio.volume = 1; // gain is baked into the WAV
      audio.setAttribute("playsinline", "true");
      (audio as any).playsInline = true;
      audio.style.display = "none";
      document.body.appendChild(audio);
      audioElRef.current = audio;

      await audio.play();

      // MediaSession for lock screen controls
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `Deeply — ${preset.nameHe || preset.name}`,
          artist: "Tabro",
          album: "Deeply",
          artwork: [
            { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          ],
        });
        navigator.mediaSession.setActionHandler("play", () => {
          audioElRef.current?.play().catch(() => {});
        });
        navigator.mediaSession.setActionHandler("pause", () => {
          stopAudio();
          setActivePresetId(null);
        });
      }

      setIsPlaying(true);
      isPlayingRef.current = true;
    } catch (e) {
      console.error("Failed to render/play preset:", e);
      stopAudio();
    } finally {
      setIsRendering(false);
    }
  }, [stopAudio]);

  const toggle = useCallback((preset: AudioPreset) => {
    if (activePresetId === preset.id && (isPlaying || isRendering)) {
      stopAudio();
      setActivePresetId(null);
    } else {
      playPreset(preset);
    }
  }, [activePresetId, isPlaying, isRendering, playPreset, stopAudio]);

  // Resume audio when returning from background
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && audioElRef.current && isPlayingRef.current) {
        audioElRef.current.play().catch(() => {});
        startSilentAudio();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Sync global state for floating mini-player (frequency presets)
  useEffect(() => {
    window._deeplyFreqState = {
      playing: isPlaying,
      name: activePresetId
        ? (PRESET_NAME_MAP[activePresetId] || activePresetId)
        : "",
      stop: () => {
        stopAudio();
        setActivePresetId(null);
      },
    };
  }, [isPlaying, activePresetId, stopAudio]);

  return { activePresetId, isPlaying, isRendering, toggle, stopAudio };
}
