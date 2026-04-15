import { useState, useCallback, useRef, useEffect } from "react";
import { AudioPreset, AUDIO_PRESETS } from "./zoneflowAudioPresets";
import { startSilentAudio, stopSilentAudio } from "./zoneflowIosSilentAudio";
import { unlockAudioContext } from "./zoneflowIosAudioUnlock";
import { renderPresetToBlob } from "./renderZoneFlowPresetToAudio";
import { resetZoneFlowAudioState, setZoneFlowAudioState, stopOtherZoneFlowAudio } from "./zoneflowAudioState";

interface ZoneFlowFreqRuntime {
  activePresetId: string | null;
  isPlaying: boolean;
  isRendering: boolean;
  audioEl: HTMLAudioElement | null;
  blobUrl: string | null;
}

declare global {
  interface Window {
    _zoneflowFreqRuntime?: ZoneFlowFreqRuntime;
  }
}

function getZoneFlowFreqRuntime(): ZoneFlowFreqRuntime {
  if (typeof window === "undefined") {
    return {
      activePresetId: null,
      isPlaying: false,
      isRendering: false,
      audioEl: null,
      blobUrl: null,
    };
  }

  if (!window._zoneflowFreqRuntime) {
    window._zoneflowFreqRuntime = {
      activePresetId: null,
      isPlaying: false,
      isRendering: false,
      audioEl: null,
      blobUrl: null,
    };
  }

  return window._zoneflowFreqRuntime;
}

// Quick lookup for preset names by id
const PRESET_NAME_MAP: Record<string, string> = {};
AUDIO_PRESETS.forEach(p => { PRESET_NAME_MAP[p.id] = p.nameHe || p.name; });

function syncFreqAudioState(activePresetId: string | null, playing: boolean, stop: () => void) {
  setZoneFlowAudioState("freq", {
    playing,
    name: activePresetId
      ? (PRESET_NAME_MAP[activePresetId] || activePresetId)
      : "",
    stop,
  });
}

/**
 * Audio engine that pre-renders presets to WAV blobs and plays them
 * through a real <audio> element. This is critical for iOS background
 * playback — iOS keeps <audio> elements alive but suspends Web Audio
 * API oscillators when the app goes to background.
 */
export function useZoneFlowAudioEngine() {
  const runtime = getZoneFlowFreqRuntime();
  const [activePresetId, setActivePresetId] = useState<string | null>(runtime.activePresetId);
  const [isPlaying, setIsPlaying] = useState(runtime.isPlaying);
  const [isRendering, setIsRendering] = useState(runtime.isRendering);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const isPlayingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    const rt = getZoneFlowFreqRuntime();
    if (rt.audioEl && !rt.audioEl.paused) {
      rt.isPlaying = true;
    }
    audioElRef.current = rt.audioEl;
    blobUrlRef.current = rt.blobUrl;
    isPlayingRef.current = rt.isPlaying;
    setActivePresetId(rt.activePresetId);
    setIsPlaying(rt.isPlaying);
    setIsRendering(rt.isRendering);

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const stopAudio = useCallback(() => {
    const rt = getZoneFlowFreqRuntime();

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
    if (mountedRef.current) {
      setIsPlaying(false);
      setIsRendering(false);
      setActivePresetId(null);
    }
    isPlayingRef.current = false;
    rt.audioEl = null;
    rt.blobUrl = null;
    rt.activePresetId = null;
    rt.isPlaying = false;
    rt.isRendering = false;
    resetZoneFlowAudioState("freq");
  }, []);

  const playPreset = useCallback(async (preset: AudioPreset) => {
    const rt = getZoneFlowFreqRuntime();
    stopAudio();
    stopOtherZoneFlowAudio("freq");

    // Stop music player when starting frequency preset
    if (window._zoneflowMusicState?.playing) {
      window._zoneflowMusicState.stop();
    }

    if (mountedRef.current) {
      setIsRendering(true);
      setActivePresetId(preset.id);
    }
    rt.activePresetId = preset.id;
    rt.isPlaying = false;
    rt.isRendering = true;
    syncFreqAudioState(preset.id, false, () => {
      stopAudio();
      if (mountedRef.current) {
        setActivePresetId(null);
      }
    });

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
      rt.audioEl = audio;
      rt.blobUrl = blobUrl;

      const publishFromAudio = () => {
        const playingNow = !!audioElRef.current && !audioElRef.current.paused;
        rt.isPlaying = playingNow;
        if (mountedRef.current) {
          setIsPlaying(playingNow);
          setActivePresetId(rt.activePresetId);
        }
        syncFreqAudioState(rt.activePresetId, playingNow, () => {
          stopAudio();
          if (mountedRef.current) {
            setActivePresetId(null);
          }
        });
      };

      audio.addEventListener("play", publishFromAudio);
      audio.addEventListener("pause", publishFromAudio);
      audio.addEventListener("ended", publishFromAudio);

      await audio.play();

      // MediaSession for lock screen controls
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `ZoneFlow — ${preset.nameHe || preset.name}`,
          artist: "Tabro",
          album: "ZoneFlow",
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

      if (mountedRef.current) {
        setIsPlaying(true);
      }
      isPlayingRef.current = true;
      rt.isPlaying = true;
      syncFreqAudioState(preset.id, true, () => {
        stopAudio();
        if (mountedRef.current) {
          setActivePresetId(null);
        }
      });
    } catch (e) {
      console.error("Failed to render/play preset:", e);
      stopAudio();
    } finally {
      if (mountedRef.current) {
        setIsRendering(false);
      }
      rt.isRendering = false;
      if (!rt.isPlaying) {
        syncFreqAudioState(rt.activePresetId, false, () => {
          stopAudio();
          if (mountedRef.current) {
            setActivePresetId(null);
          }
        });
      }
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

  useEffect(() => {
    const interval = window.setInterval(() => {
      const rt = getZoneFlowFreqRuntime();
      const actuallyPlaying = !!rt.audioEl && !rt.audioEl.paused;
      const activePresetChanged = rt.activePresetId !== activePresetId;
      const playingChanged = rt.isPlaying !== actuallyPlaying || isPlayingRef.current !== actuallyPlaying;

      if (playingChanged || activePresetChanged) {
        rt.isPlaying = actuallyPlaying;
        if (mountedRef.current) {
          setIsPlaying(actuallyPlaying);
          setActivePresetId(rt.activePresetId);
        }
        isPlayingRef.current = actuallyPlaying;
        syncFreqAudioState(rt.activePresetId, actuallyPlaying, () => {
          stopAudio();
          if (mountedRef.current) {
            setActivePresetId(null);
          }
        });
      }
    }, 800);

    return () => window.clearInterval(interval);
  }, [activePresetId, stopAudio]);

  // Sync global state for floating mini-player (frequency presets)
  useEffect(() => {
    syncFreqAudioState(activePresetId, isPlaying, () => {
      stopAudio();
      setActivePresetId(null);
    });
  }, [isPlaying, activePresetId, stopAudio]);

  return { activePresetId, isPlaying, isRendering, toggle, stopAudio };
}
