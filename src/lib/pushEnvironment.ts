export interface PushEnvironmentInput {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  standalone: boolean;
  secure: boolean;
  serviceWorker: boolean;
  pushManager: boolean;
  notifications: boolean;
}

export function describePushEnvironment(input: PushEnvironmentInput) {
  const ios = /iPhone|iPad|iPod/i.test(input.userAgent) || (input.platform === "MacIntel" && input.maxTouchPoints > 1);
  const reason = !input.secure ? "insecure" : ios && !input.standalone ? "home-screen" :
    !input.serviceWorker || !input.pushManager || !input.notifications ? "unsupported" : null;
  return { ios, standalone: input.standalone, reason };
}

export function readPushEnvironment() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { ios: false, standalone: false, reason: "unsupported" as const };
  }
  return describePushEnvironment({
    userAgent: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints || 0,
    standalone: window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    secure: window.isSecureContext, serviceWorker: "serviceWorker" in navigator,
    pushManager: "PushManager" in window, notifications: "Notification" in window,
  });
}

export async function withPushTimeout<T>(promise: PromiseLike<T>, milliseconds = 10_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("push_setup_timeout")), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
