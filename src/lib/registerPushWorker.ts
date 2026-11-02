export async function registerPushWorker() {
  if (typeof window === "undefined" || !window.isSecureContext || !("serviceWorker" in navigator)) return;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) {
      await existing.update();
      return;
    }
    // Registration is not permission: the user still explicitly enables push.
    await navigator.serviceWorker.register("/sw-push.js", { scope: "/", updateViaCache: "none" });
  } catch {
    // App navigation and sign-in must keep working when workers are unavailable.
    console.info("Tabro push worker unavailable in this browser context");
  }
}
