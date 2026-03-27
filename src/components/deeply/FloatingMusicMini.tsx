import { useState, useEffect } from "react";
import { Music, StopCircle, Volume2 } from "lucide-react";

/**
 * Tiny floating mini-player that appears when Deeply audio is playing
 * and the user navigates away from the Deeply tab.
 * Reads from window._deeplyMusicState (set by DeeplyMusicPlayer & useAudioEngine).
 */

declare global {
  interface Window {
    _deeplyMusicState?: {
      playing: boolean;
      name: string;
      stop: () => void;
    };
    _deeplyFreqState?: {
      playing: boolean;
      name: string;
      stop: () => void;
    };
  }
}

interface FloatingMusicMiniProps {
  visible: boolean;
  onGoToDeeply?: () => void;
}

export function FloatingMusicMini({ visible, onGoToDeeply }: FloatingMusicMiniProps) {
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [freqPlaying, setFreqPlaying] = useState(false);
  const [musicName, setMusicName] = useState("");
  const [freqName, setFreqName] = useState("");

  // Poll for state changes (every 400ms for responsiveness)
  useEffect(() => {
    const check = () => {
      const ms = window._deeplyMusicState;
      setMusicPlaying(!!ms?.playing);
      setMusicName(ms?.name || "");

      const fs = window._deeplyFreqState;
      setFreqPlaying(!!fs?.playing);
      setFreqName(fs?.name || "");
    };
    check();
    const interval = setInterval(check, 400);
    return () => clearInterval(interval);
  }, []);

  const isAnythingPlaying = musicPlaying || freqPlaying;

  if (!visible || !isAnythingPlaying) return null;

  const displayName = musicPlaying ? musicName : freqName;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] animate-in slide-in-from-bottom-2 fade-in duration-300">
      <div
        className="flex items-center gap-2 rounded-xl bg-purple-600 shadow-lg shadow-purple-900/40 px-3 py-2 cursor-pointer hover:scale-105 transition-transform relative group"
        onClick={onGoToDeeply}
        title={displayName || "מוזיקה מנגנת"}
      >
        {musicPlaying ? (
          <Music className="h-4 w-4 text-white animate-pulse shrink-0" />
        ) : (
          <Volume2 className="h-4 w-4 text-white animate-pulse shrink-0" />
        )}
        <span className="text-[11px] text-white/90 max-w-[120px] truncate leading-none">
          {displayName || "מנגן"}
        </span>

        {/* Stop buttons */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {musicPlaying && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                window._deeplyMusicState?.stop();
              }}
              className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md"
              title="עצור מוזיקה"
            >
              <StopCircle className="h-3 w-3" />
            </button>
          )}
          {freqPlaying && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                window._deeplyFreqState?.stop();
              }}
              className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md"
              title="עצור תדר"
            >
              <StopCircle className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
