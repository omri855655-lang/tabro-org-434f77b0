import * as React from "react";
import { COMPACT_WORKSPACE_QUERY, PHONE_QUERY } from '@/lib/responsiveWorkspace';

export function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);

  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => {
      setMatches(mql.matches);
    };
    onChange();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}
export function useIsMobile() { return useMediaQuery(PHONE_QUERY); }
export function useCompactWorkspace() { return useMediaQuery(COMPACT_WORKSPACE_QUERY); }
