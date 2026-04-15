import { useEffect, useMemo, useState } from "react";
import { Minimize2, X } from "lucide-react";
import {
  getZoneFlowYoutubePlayerState,
  resetZoneFlowAudioState,
  resetZoneFlowYoutubePlayerState,
  setZoneFlowAudioState,
  setZoneFlowYoutubePlayerState,
  subscribeToZoneFlowYoutubePlayerState,
} from "./zoneflowAudioState";

export function GlobalZoneFlowYouTubePlayer() {
  const [playerState, setPlayerState] = useState(getZoneFlowYoutubePlayerState());

  useEffect(() => {
    setPlayerState(getZoneFlowYoutubePlayerState());
    return subscribeToZoneFlowYoutubePlayerState(() => {
      setPlayerState(getZoneFlowYoutubePlayerState());
    });
  }, []);

  useEffect(() => {
    if (!playerState.videoId) {
      resetZoneFlowAudioState("youtube");
      return;
    }

    setZoneFlowAudioState("youtube", {
      playing: true,
      name: playerState.title || "YouTube",
      stop: () => {
        resetZoneFlowYoutubePlayerState();
      },
    });

    return () => {
      resetZoneFlowAudioState("youtube");
    };
  }, [playerState.videoId, playerState.title]);

  const iframeSrc = useMemo(() => {
    if (!playerState.videoId) return "";
    const params = new URLSearchParams({
      autoplay: "1",
      playsinline: "1",
      enablejsapi: "1",
      rel: "0",
    });
    return `https://www.youtube.com/embed/${playerState.videoId}?${params.toString()}`;
  }, [playerState.videoId]);

  if (!playerState.videoId) return null;

  return (
    <div
      aria-hidden={!playerState.viewerOpen}
      className={playerState.viewerOpen
        ? "fixed bottom-24 left-4 right-4 z-[9998] md:bottom-4 md:left-auto md:right-4 md:w-[420px]"
        : "fixed bottom-0 right-0 z-[-1] h-px w-px overflow-hidden opacity-0 pointer-events-none"
      }
    >
      {playerState.viewerOpen && (
        <div className="mb-2 flex items-center justify-between rounded-t-xl border border-white/10 bg-black/80 px-3 py-2 text-white shadow-xl">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{playerState.title || "YouTube"}</p>
            <p className="text-[11px] text-white/60">תיבת צפייה פתוחה</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoneFlowYoutubePlayerState({ ...playerState, viewerOpen: false })}
              className="rounded-md bg-white/10 p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white"
              title="הסתר תיבה"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => resetZoneFlowYoutubePlayerState()}
              className="rounded-md bg-white/10 p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white"
              title="סגור נגן"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <iframe
        key={playerState.videoId}
        width={playerState.viewerOpen ? "420" : "1"}
        height={playerState.viewerOpen ? "236" : "1"}
        src={iframeSrc}
        title={playerState.title || "YouTube Player"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className={playerState.viewerOpen ? "aspect-video w-full rounded-b-xl border-0 bg-black shadow-2xl" : "border-0"}
      />
    </div>
  );
}
