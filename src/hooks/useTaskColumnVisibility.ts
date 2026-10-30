import { useEffect, useState } from "react";
import { normalizeHiddenTaskColumns } from "@/lib/taskColumnVisibility";

function read(scope: string): string[] {
  try { return normalizeHiddenTaskColumns(JSON.parse(localStorage.getItem(scope) || "[]")); }
  catch { return []; }
}

export function useTaskColumnVisibility(scope: string) {
  const [state, setState] = useState(() => ({ scope, hidden: read(scope) }));
  const [saveFailed, setSaveFailed] = useState(false);
  const hidden = state.scope === scope ? state.hidden : read(scope);
  useEffect(() => {
    setState({ scope, hidden: read(scope) });
    setSaveFailed(false);
    const refresh = (event: StorageEvent) => {
      if (event.key === scope || event.key === null) setState({ scope, hidden: read(scope) });
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [scope]);
  function save(value: string[]) {
    const next = normalizeHiddenTaskColumns(value);
    setState({ scope, hidden: next });
    try { localStorage.setItem(scope, JSON.stringify(next)); setSaveFailed(false); }
    catch { setSaveFailed(true); }
  }
  return { hidden, saveFailed, toggle: (key: string) => save(hidden.includes(key) ? hidden.filter(item => item !== key) : [...hidden, key]), reset: () => save([]) };
}
