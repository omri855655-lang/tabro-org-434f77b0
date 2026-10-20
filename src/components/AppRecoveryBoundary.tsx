import { Component, type ReactNode } from "react";

export default class AppRecoveryBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error("Application render failed", error.name); }
  render() {
    if (!this.state.failed) return this.props.children;
    // Native links still work when the router or another root-level component fails.
    return <main dir="rtl" role="alert" className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-lg space-y-4 rounded-3xl border bg-card p-6 shadow-sm">
        <p className="text-xs font-semibold text-muted-foreground">TABRO · APP_RENDER_FAILED</p>
        <h1 className="text-2xl font-bold">לא הצלחנו להציג את המסך</h1>
        <p className="text-sm leading-6 text-muted-foreground">אפשר לחזור לדשבורד או לדף הבית. אין צורך למחוק נתוני דפדפן או לנתק חיבורים. מידע שכבר נשמר נשאר בחשבון; שינויים שטרם נשמרו עשויים לדרוש הזנה מחדש.</p>
        <div className="flex flex-wrap gap-3"><a href="/personal" className="rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground">פתח מחדש את הדשבורד</a><a href="/" className="rounded-xl border px-4 py-3 text-sm font-medium">דף הבית</a></div>
        <p lang="en" dir="ltr" className="border-t pt-3 text-xs text-muted-foreground">This screen could not be displayed. Reopen the dashboard or homepage. Saved account data has not been cleared.</p>
      </section>
    </main>;
  }
}
