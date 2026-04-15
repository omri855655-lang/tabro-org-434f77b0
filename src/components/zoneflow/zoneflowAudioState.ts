export type ZoneFlowAudioKind = "music" | "freq" | "youtube";

export interface ZoneFlowAudioStateValue {
  playing: boolean;
  name: string;
  stop: () => void;
}

interface ZoneFlowFreqRuntimeSnapshot {
  activePresetId: string | null;
  isPlaying: boolean;
  audioEl: HTMLAudioElement | null;
}

type ZoneFlowAudioWindowKey = "_zoneflowMusicState" | "_zoneflowFreqState" | "_zoneflowYoutubeState";

export interface ZoneFlowYoutubePlayerState {
  videoId: string | null;
  title: string;
  viewerOpen: boolean;
}

declare global {
  interface Window {
    _zoneflowMusicState?: ZoneFlowAudioStateValue;
    _zoneflowFreqState?: ZoneFlowAudioStateValue;
    _zoneflowYoutubeState?: ZoneFlowAudioStateValue;
    _zoneflowFreqRuntime?: ZoneFlowFreqRuntimeSnapshot;
    _zoneflowAudioStateListeners?: Set<() => void>;
    _zoneflowYoutubePlayerState?: ZoneFlowYoutubePlayerState;
    _zoneflowYoutubePlayerListeners?: Set<() => void>;
  }
}

const EMPTY_STATE: ZoneFlowAudioStateValue = {
  playing: false,
  name: "",
  stop: () => {},
};

const AUDIO_STATE_KEYS: Record<ZoneFlowAudioKind, ZoneFlowAudioWindowKey> = {
  music: "_zoneflowMusicState",
  freq: "_zoneflowFreqState",
  youtube: "_zoneflowYoutubeState",
};

function canUseWindow() {
  return typeof window !== "undefined";
}

function getAudioStateKey(kind: ZoneFlowAudioKind) {
  return AUDIO_STATE_KEYS[kind];
}

function notifyZoneFlowAudioListeners() {
  if (!canUseWindow()) return;
  window._zoneflowAudioStateListeners?.forEach((listener) => listener());
}

function notifyZoneFlowYoutubePlayerListeners() {
  if (!canUseWindow()) return;
  window._zoneflowYoutubePlayerListeners?.forEach((listener) => listener());
}

export function setZoneFlowAudioState(kind: ZoneFlowAudioKind, value: ZoneFlowAudioStateValue) {
  if (!canUseWindow()) return;
  window[getAudioStateKey(kind)] = value;
  notifyZoneFlowAudioListeners();
}

export function resetZoneFlowAudioState(kind: ZoneFlowAudioKind) {
  if (!canUseWindow()) return;
  window[getAudioStateKey(kind)] = { ...EMPTY_STATE };
  notifyZoneFlowAudioListeners();
}

export function subscribeToZoneFlowAudioState(listener: () => void) {
  if (!canUseWindow()) return () => {};

  if (!window._zoneflowAudioStateListeners) {
    window._zoneflowAudioStateListeners = new Set();
  }

  window._zoneflowAudioStateListeners.add(listener);

  return () => {
    window._zoneflowAudioStateListeners?.delete(listener);
  };
}

export function getActiveZoneFlowAudio() {
  if (!canUseWindow()) return [] as Array<ZoneFlowAudioStateValue & { kind: ZoneFlowAudioKind }>;

  const states = (Object.keys(AUDIO_STATE_KEYS) as ZoneFlowAudioKind[])
    .map((kind) => ({
      kind,
      ...(window[getAudioStateKey(kind)] || EMPTY_STATE),
    }));

  const freqState = states.find((state) => state.kind === "freq");
  const freqRuntime = window._zoneflowFreqRuntime;

  if (
    freqState &&
    !freqState.playing &&
    freqRuntime?.audioEl &&
    !freqRuntime.audioEl.paused
  ) {
    freqState.playing = true;
    freqState.name = freqState.name || freqRuntime.activePresetId || "תדר פעיל";
  }

  return states.filter((state) => state.playing);
}

export function stopOtherZoneFlowAudio(activeKind: ZoneFlowAudioKind) {
  if (!canUseWindow()) return;

  (Object.keys(AUDIO_STATE_KEYS) as ZoneFlowAudioKind[]).forEach((kind) => {
    if (kind === activeKind) return;
    const state = window[getAudioStateKey(kind)];
    if (state?.playing) {
      state.stop();
    }
  });
}

const EMPTY_YOUTUBE_PLAYER_STATE: ZoneFlowYoutubePlayerState = {
  videoId: null,
  title: "",
  viewerOpen: false,
};

export function getZoneFlowYoutubePlayerState(): ZoneFlowYoutubePlayerState {
  if (!canUseWindow()) return EMPTY_YOUTUBE_PLAYER_STATE;
  return window._zoneflowYoutubePlayerState || EMPTY_YOUTUBE_PLAYER_STATE;
}

export function setZoneFlowYoutubePlayerState(value: ZoneFlowYoutubePlayerState) {
  if (!canUseWindow()) return;
  window._zoneflowYoutubePlayerState = value;
  notifyZoneFlowYoutubePlayerListeners();
}

export function resetZoneFlowYoutubePlayerState() {
  if (!canUseWindow()) return;
  window._zoneflowYoutubePlayerState = { ...EMPTY_YOUTUBE_PLAYER_STATE };
  notifyZoneFlowYoutubePlayerListeners();
}

export function subscribeToZoneFlowYoutubePlayerState(listener: () => void) {
  if (!canUseWindow()) return () => {};

  if (!window._zoneflowYoutubePlayerListeners) {
    window._zoneflowYoutubePlayerListeners = new Set();
  }

  window._zoneflowYoutubePlayerListeners.add(listener);

  return () => {
    window._zoneflowYoutubePlayerListeners?.delete(listener);
  };
}
