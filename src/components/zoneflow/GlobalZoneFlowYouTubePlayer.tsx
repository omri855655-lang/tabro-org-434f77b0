import { useEffect, useMemo, useState } from "react";
import {
  getZoneFlowYoutubePlayerState,
  resetZoneFlowAudioState,
  resetZoneFlowYoutubePlayerState,
  setZoneFlowAudioState,
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

  if (!playerState.videoId || playerState.viewerOpen) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed bottom-0 right-0 z-[-1] h-px w-px overflow-hidden opacity-0 pointer-events-none"
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
  );
}
