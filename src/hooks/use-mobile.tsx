import * as React from "react";
import { COMPACT_WORKSPACE_QUERY, PHONE_QUERY } from '@/lib/responsiveWorkspace';

export function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);

  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => {
      setMatches(mql.matches);
    };
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
export function useIsMobile() { return useMediaQuery(PHONE_QUERY); }
export function useCompactWorkspace() { return useMediaQuery(COMPACT_WORKSPACE_QUERY); }
