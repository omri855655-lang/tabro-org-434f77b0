export async function ensurePushWorker(): Promise<ServiceWorkerRegistration> {
  // Registering the canonical script replaces a legacy root worker without
  // deleting its subscription or asking the user for notification permission.
  return navigator.serviceWorker.register("/sw-push.js", { scope: "/", updateViaCache: "none" });
}

export async function registerPushWorker() {
  if (typeof window === "undefined" || !window.isSecureContext || !("serviceWorker" in navigator)) return;
  try {
    // Registration is not permission: the user still explicitly enables push.
    await ensurePushWorker();
  } catch {
    // App navigation and sign-in must keep working when workers are unavailable.
    console.info("Tabro push worker unavailable in this browser context");
  }
}
