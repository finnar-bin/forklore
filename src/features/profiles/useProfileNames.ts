import { useEffect, useState } from 'react';
import { fetchProfileNames } from './api';

// Keyed on a sorted, deduped join of the ids rather than the array itself —
// callers typically pass a freshly-mapped array every render (e.g.
// `ingredients.map(i => i.created_by)`), which would re-fetch every render
// if this effect depended on the array reference directly.
export function useProfileNames(userIds: string[]): Record<string, string> {
  const key = Array.from(new Set(userIds)).sort().join(',');
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!key) {
      setNames({});
      return;
    }
    let cancelled = false;
    fetchProfileNames(key.split(','))
      .then((result) => {
        if (!cancelled) setNames(result);
      })
      .catch(() => {
        if (!cancelled) setNames({});
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return names;
}
