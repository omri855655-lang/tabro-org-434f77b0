export type DeeplyAudioKind = "music" | "freq" | "youtube";

export interface DeeplyAudioStateValue {
  playing: boolean;
  name: string;
  stop: () => void;
}

type DeeplyAudioWindowKey = "_deeplyMusicState" | "_deeplyFreqState" | "_deeplyYoutubeState";

declare global {
  interface Window {
    _deeplyMusicState?: DeeplyAudioStateValue;
    _deeplyFreqState?: DeeplyAudioStateValue;
    _deeplyYoutubeState?: DeeplyAudioStateValue;
    _deeplyAudioStateListeners?: Set<() => void>;
  }
}

const EMPTY_STATE: DeeplyAudioStateValue = {
  playing: false,
  name: "",
  stop: () => {},
};

const AUDIO_STATE_KEYS: Record<DeeplyAudioKind, DeeplyAudioWindowKey> = {
  music: "_deeplyMusicState",
  freq: "_deeplyFreqState",
  youtube: "_deeplyYoutubeState",
};

function canUseWindow() {
  return typeof window !== "undefined";
}

function getAudioStateKey(kind: DeeplyAudioKind) {
  return AUDIO_STATE_KEYS[kind];
}

function notifyDeeplyAudioListeners() {
  if (!canUseWindow()) return;
  window._deeplyAudioStateListeners?.forEach((listener) => listener());
}

export function setDeeplyAudioState(kind: DeeplyAudioKind, value: DeeplyAudioStateValue) {
  if (!canUseWindow()) return;
  window[getAudioStateKey(kind)] = value;
  notifyDeeplyAudioListeners();
}

export function resetDeeplyAudioState(kind: DeeplyAudioKind) {
  if (!canUseWindow()) return;
  window[getAudioStateKey(kind)] = { ...EMPTY_STATE };
  notifyDeeplyAudioListeners();
}

export function subscribeToDeeplyAudioState(listener: () => void) {
  if (!canUseWindow()) return () => {};

  if (!window._deeplyAudioStateListeners) {
    window._deeplyAudioStateListeners = new Set();
  }

  window._deeplyAudioStateListeners.add(listener);

  return () => {
    window._deeplyAudioStateListeners?.delete(listener);
  };
}

export function getActiveDeeplyAudio() {
  if (!canUseWindow()) return [] as Array<DeeplyAudioStateValue & { kind: DeeplyAudioKind }>;

  return (Object.keys(AUDIO_STATE_KEYS) as DeeplyAudioKind[])
    .map((kind) => ({
      kind,
      ...(window[getAudioStateKey(kind)] || EMPTY_STATE),
    }))
    .filter((state) => state.playing);
}

export function stopOtherDeeplyAudio(activeKind: DeeplyAudioKind) {
  if (!canUseWindow()) return;

  (Object.keys(AUDIO_STATE_KEYS) as DeeplyAudioKind[]).forEach((kind) => {
    if (kind === activeKind) return;
    const state = window[getAudioStateKey(kind)];
    if (state?.playing) {
      state.stop();
    }
  });
}