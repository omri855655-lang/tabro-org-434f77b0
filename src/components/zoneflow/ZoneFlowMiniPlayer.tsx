import { useEffect, useState } from "react";
import { Eye, Music, Square, Volume2 } from "lucide-react";
import {
  getActiveZoneFlowAudio,
  getZoneFlowYoutubePlayerState,
  setZoneFlowYoutubePlayerState,
  subscribeToZoneFlowAudioState,
} from "./zoneflowAudioState";

/**
 * Tiny floating mini-player that appears when ZoneFlow audio is playing
 * and the user navigates away from the ZoneFlow tab.
 * Reads from window._zoneflowMusicState.
 */

interface ZoneFlowMiniPlayerProps {
  visible: boolean;
  onGoToZoneFlow?: () => void;
}

export function ZoneFlowMiniPlayer({ visible, onGoToZoneFlow }: ZoneFlowMiniPlayerProps) {
  const [activeAudio, setActiveAudio] = useState(getActiveZoneFlowAudio());

  useEffect(() => {
    setActiveAudio(getActiveZoneFlowAudio());
    const unsubscribe = subscribeToZoneFlowAudioState(() => {
      setActiveAudio(getActiveZoneFlowAudio());
    });

    const interval = window.setInterval(() => {
      setActiveAudio(getActiveZoneFlowAudio());
    }, 800);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, []);

  const isAnythingPlaying = activeAudio.length > 0;

  if (!visible || !isAnythingPlaying) return null;

  const primaryAudio = activeAudio[0];
  const displayName = primaryAudio?.name || "מנגן";

  return (
    <div className="fixed bottom-24 right-4 z-[9999] animate-in slide-in-from-bottom-2 fade-in duration-300 md:bottom-4">
      <div
        className="flex items-center gap-2 rounded-xl border bg-card text-card-foreground shadow-lg px-3 py-2 cursor-pointer hover:scale-105 transition-transform relative group"
        onClick={onGoToZoneFlow}
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
            <div key={`${audio.kind}-${audio.name}`} className="flex items-center gap-1">
              {audio.kind === "youtube" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const current = getZoneFlowYoutubePlayerState();
                    if (!current.videoId) return;
                    setZoneFlowYoutubePlayerState({
                      ...current,
                      viewerOpen: true,
                    });
                  }}
                  className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md"
                  title="פתח וידאו"
                >
                  <Eye className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  audio.stop();
                }}
                className="h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md"
                title={`עצור ${audio.name || "אודיו"}`}
              >
                <Square className="h-2.5 w-2.5 fill-current" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
