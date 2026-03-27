import { useEffect, useState } from "react";
import { Music, StopCircle, Volume2 } from "lucide-react";
import { getActiveDeeplyAudio, subscribeToDeeplyAudioState } from "./deeplyAudioState";

/**
 * Tiny floating mini-player that appears when Deeply audio is playing
 * and the user navigates away from the Deeply tab.
 * Reads from window._deeplyMusicState (set by DeeplyMusicPlayer & useAudioEngine).
 */

interface FloatingMusicMiniProps {
  visible: boolean;
  onGoToDeeply?: () => void;
}

export function FloatingMusicMini({ visible, onGoToDeeply }: FloatingMusicMiniProps) {
  const [activeAudio, setActiveAudio] = useState(getActiveDeeplyAudio());

  useEffect(() => {
    setActiveAudio(getActiveDeeplyAudio());
    return subscribeToDeeplyAudioState(() => {
      setActiveAudio(getActiveDeeplyAudio());
    });
  }, []);

  const isAnythingPlaying = activeAudio.length > 0;

  if (!visible || !isAnythingPlaying) return null;

  const primaryAudio = activeAudio[0];
  const displayName = primaryAudio?.name || "מנגן";

  return (
    <div className="fixed bottom-4 right-4 z-[9999] animate-in slide-in-from-bottom-2 fade-in duration-300">
      <div
        className="flex items-center gap-2 rounded-xl border bg-card text-card-foreground shadow-lg px-3 py-2 cursor-pointer hover:scale-105 transition-transform relative group"
        onClick={onGoToDeeply}
        title={displayName || "מוזיקה מנגנת"}
      >
        {primaryAudio?.kind === "freq" ? (
          <Volume2 className="h-4 w-4 text-primary animate-pulse shrink-0" />
        ) : (
          <Music className="h-4 w-4 text-primary animate-pulse shrink-0" />
        )}
        <span className="text-[11px] text-muted-foreground max-w-[120px] truncate leading-none">
          {displayName || "מנגן"}
        </span>

        <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          {activeAudio.map((audio) => (
            <button
              key={`${audio.kind}-${audio.name}`}
              onClick={(e) => {
                e.stopPropagation();
                audio.stop();
              }}
              className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md"
              title={`עצור ${audio.name || "אודיו"}`}
            >
              <StopCircle className="h-3 w-3" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
