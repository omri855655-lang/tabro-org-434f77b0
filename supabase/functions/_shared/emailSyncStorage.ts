export function gmailMessageDate(internalDate: unknown, headerDate: unknown): string {
  const milliseconds = typeof internalDate === "string" && /^\d+$/.test(internalDate) ? Number(internalDate) : NaN;
  const received = new Date(Number.isFinite(milliseconds) ? milliseconds : String(headerDate || ""));
  if (Number.isNaN(received.getTime())) throw new Error("Invalid message date");
  return received.toISOString();
}

type Store = { from(table: string): { upsert(row: Record<string, unknown>, options: { onConflict: string }): PromiseLike<{ error: { code?: string; message?: string } | null }> } };

export async function saveSyncedEmail(store: Store, row: Record<string, unknown>): Promise<void> {
  if (!row.user_id || !row.connection_id || !row.external_message_id) throw new Error("Missing message identity");
  const { error } = await store.from("email_analyses").upsert(row, { onConflict: "connection_id,external_message_id" });
  if (error) throw new Error(`Email storage rejected (${error.code || "unknown"})`);
}
