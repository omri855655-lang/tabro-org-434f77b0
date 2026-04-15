import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, EyeOff, Square } from "lucide-react";
import {
  getZoneFlowYoutubePlayerState,
  resetZoneFlowAudioState,
  resetZoneFlowYoutubePlayerState,
  setZoneFlowAudioState,
  setZoneFlowYoutubePlayerState,
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
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!playerState.videoId || !playerState.viewerOpen || activeTab !== "zoneflow") {
      setAnchorRect(null);
      return;
    }

    const syncAnchor = () => {
      const anchor = document.getElementById("zoneflow-youtube-viewer-anchor");
      if (!anchor) {
        setAnchorRect(null);
        return;
      }
      setAnchorRect(anchor.getBoundingClientRect());
    };

    syncAnchor();
    const interval = window.setInterval(syncAnchor, 250);
    window.addEventListener("resize", syncAnchor);
    window.addEventListener("scroll", syncAnchor, true);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("resize", syncAnchor);
      window.removeEventListener("scroll", syncAnchor, true);
    };
  }, [activeTab, playerState.videoId, playerState.viewerOpen]);

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

  const viewerMode = playerState.viewerOpen
    ? activeTab === "zoneflow" && anchorRect
      ? "inline"
      : activeTab !== "zoneflow"
        ? "mini"
        : "hidden"
    : "hidden";

  const containerClassName =
    viewerMode === "inline"
      ? "fixed z-[9998] overflow-hidden rounded-xl border border-cyan-400/30 bg-black shadow-2xl"
      : viewerMode === "mini"
        ? "fixed bottom-24 right-4 z-[9998] overflow-hidden rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur md:bottom-4"
        : "fixed bottom-0 right-0 z-[-1] h-px w-px overflow-hidden opacity-0 pointer-events-none";

  const containerStyle =
    viewerMode === "inline" && anchorRect
      ? {
          top: `${Math.max(anchorRect.top, 0)}px`,
          left: `${Math.max(anchorRect.left, 0)}px`,
          width: `${anchorRect.width}px`,
          height: `${anchorRect.height}px`,
        }
      : undefined;

  const iframeClassName =
    viewerMode === "inline"
      ? "h-full w-full border-0"
      : viewerMode === "mini" && collapsed
        ? "h-px w-px border-0 opacity-0 pointer-events-none"
        : viewerMode === "mini"
          ? "h-[160px] w-[284px] border-0 bg-black"
          : "h-px w-px border-0";

  return (
    <div aria-hidden={viewerMode === "hidden"} className={containerClassName} style={containerStyle}>
      {viewerMode === "mini" && (
        <div className="overflow-hidden rounded-2xl">
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
        </div>
      )}

      <iframe
        key={playerState.videoId}
        src={iframeSrc}
        title={playerState.title || "YouTube Player"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className={iframeClassName}
      />
    </div>
  );
}
