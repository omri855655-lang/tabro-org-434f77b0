import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, EyeOff, Square } from "lucide-react";
import {
  getZoneFlowYoutubePlayerState,
  resetZoneFlowAudioState,
  resetZoneFlowYoutubePlayerState,
  setZoneFlowAudioState,
  subscribeToZoneFlowYoutubePlayerState,
} from "./zoneflowAudioState";

interface GlobalZoneFlowYouTubePlayerProps {
  activeTab?: string;
}

export function GlobalZoneFlowYouTubePlayer({ activeTab }: GlobalZoneFlowYouTubePlayerProps) {
  const [playerState, setPlayerState] = useState(getZoneFlowYoutubePlayerState());
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("zoneflow-floating-yt-collapsed") === "1";
  });

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("zoneflow-floating-yt-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

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

  const showExpandedViewer = playerState.viewerOpen;
  const showLargeViewer = false;
  const showMiniViewer = showExpandedViewer && activeTab !== "zoneflow";

  return (
    <>
      <div
        aria-hidden={!showLargeViewer}
        className={showLargeViewer ? "fixed inset-x-4 bottom-24 z-[9998] md:bottom-6 md:left-1/2 md:right-auto md:w-[min(72vw,900px)] md:-translate-x-1/2" : "hidden"}
      >
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/90 shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2 text-white">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{playerState.title || "YouTube"}</p>
              <p className="text-[11px] text-white/60">נגן רציף של ZoneFlow</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoneFlowYoutubePlayerState({ ...playerState, viewerOpen: false })}
                className="rounded-md bg-white/10 p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white"
                title="מזער"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                onClick={() => resetZoneFlowYoutubePlayerState()}
                className="rounded-md bg-rose-500/20 p-1.5 text-rose-100 transition hover:bg-rose-500/30 hover:text-white"
                title="עצור"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            </div>
          </div>
          <iframe
            key={playerState.videoId}
            src={iframeSrc}
            title={playerState.title || "YouTube Player"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="aspect-video w-full border-0"
          />
        </div>
      </div>

      <div
        aria-hidden={!showMiniViewer}
        className={showMiniViewer ? "fixed bottom-24 right-4 z-[9998] md:bottom-4" : "hidden"}
      >
        <div className="overflow-hidden rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-2 px-3 py-2 text-card-foreground">
            <div className="min-w-0">
              <p className="max-w-[180px] truncate text-xs font-medium">{playerState.title || "YouTube"}</p>
              <p className="text-[10px] text-muted-foreground">מנגן ברקע</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCollapsed((prev) => !prev)}
                className="rounded-md bg-muted p-1.5 text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
                title={collapsed ? "פתח" : "מזער"}
              >
                {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => setZoneFlowYoutubePlayerState({ ...playerState, viewerOpen: false })}
                className="rounded-md bg-muted p-1.5 text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
                title="הסתר וידאו"
              >
                <EyeOff className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => resetZoneFlowYoutubePlayerState()}
                className="rounded-md bg-rose-500/15 p-1.5 text-rose-500 transition hover:bg-rose-500/25"
                title="עצור"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            </div>
          </div>
          {!collapsed && (
            <iframe
              key={playerState.videoId}
              src={iframeSrc}
              title={playerState.title || "YouTube Player"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-[160px] w-[284px] border-0 bg-black"
            />
          )}
        </div>
      </div>

      <div
        aria-hidden={showExpandedViewer}
        className={showExpandedViewer ? "fixed bottom-0 right-0 z-[-1] h-px w-px overflow-hidden opacity-0 pointer-events-none" : "fixed bottom-0 right-0 z-[-1] h-px w-px overflow-hidden opacity-0 pointer-events-none"}
      >
        <iframe
          key={playerState.videoId}
          width="1"
          height="1"
          src={iframeSrc}
          title={playerState.title || "YouTube Player"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="border-0"
        />
      </div>
    </>
  );
}
