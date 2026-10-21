import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/lib/safeLocalStorage";
import { createLearningHistoryStore, learningHistoryKey, mergeLearningEntries, normalizeLearningEntries, type LearningEntry, type LearningHistoryClient } from "@/lib/learningHistory";

const store = createLearningHistoryStore(supabase as unknown as LearningHistoryClient);
async function bounded<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([request, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Learning sync timeout")), 20000); })]); }
  finally { if (timer) clearTimeout(timer); }
}

export function useLearningHistory(userId?: string) {
  const key = learningHistoryKey(userId);
  const [history, setHistory] = useState(() => normalizeLearningEntries(safeLocalStorage.getJSON(key, [])));
  const [status, setStatus] = useState<"local" | "syncing" | "synced" | "error">("local");
  const current = useRef(history);
  const active = useRef(true);
  const operation = useRef(0);
  const commit = useCallback((entries: LearningEntry[]) => {
    if (!active.current) return;
    current.current = entries; setHistory(entries); safeLocalStorage.setJSON(key, entries);
  }, [key]);
  const sync = useCallback(async () => {
    if (!userId) return;
    const run = ++operation.current;
    setStatus("syncing");
    try {
      const remote = await bounded(store.read(userId));
      if (!active.current) return;
      const missing = current.current.filter(entry => !remote.some(row => row.id === entry.id));
      commit(mergeLearningEntries(current.current, remote));
      if (missing.length) await bounded(store.save(userId, missing));
      if (active.current && run === operation.current) setStatus("synced");
    } catch {
      if (active.current && run === operation.current) setStatus("error");
    }
  }, [commit, userId]);
  useEffect(() => {
    active.current = true; void sync();
    const refresh = () => { if (document.visibilityState === "visible") void sync(); };
    window.addEventListener("online", refresh); window.addEventListener("focus", refresh);
    return () => { active.current = false; window.removeEventListener("online", refresh); window.removeEventListener("focus", refresh); };
  }, [sync]);
  const add = useCallback(async (entry: LearningEntry) => {
    if (!active.current) return false;
    commit(mergeLearningEntries(current.current, [entry]));
    if (!userId) return false;
    const run = ++operation.current; setStatus("syncing");
    try {
      await bounded(store.save(userId, [entry]));
      if (active.current && run === operation.current) setStatus("synced");
      return true;
    } catch {
      if (active.current && run === operation.current) setStatus("error");
      return false;
    }
  }, [commit, userId]);
  return { history, status, add, sync };
}
