// Server-only authorization for scheduled (cron) calls. The scheduler sends a random
// token kept in a database schema the public API cannot read; this checks it through a
// function only the service role may execute. Never log or return the token.
// deno-lint-ignore no-explicit-any
export async function hasSchedulerToken(req: Request, admin: any, name: string): Promise<boolean> {
  const token = req.headers.get("x-scheduler-token") || "";
  if (token.length < 32 || token.length > 256) return false;
  try {
    const { data, error } = await admin.rpc("verify_scheduler_token", { p_name: name, p_token: token });
    return !error && data === true;
  } catch {
    return false;
  }
}
