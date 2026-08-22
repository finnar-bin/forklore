import { useEffect, useState } from 'react';
import { fetchProfileNames } from './api';

// Keyed on a sorted, deduped join of the ids rather than the array itself —
// callers typically pass a freshly-mapped array every render (e.g.
// `ingredients.map(i => i.created_by)`), which would re-fetch every render
// if this effect depended on the array reference directly.
export function useProfileNames(userIds: string[]): Record<string, string> {
  // `.filter(Boolean)` guards the same way fetchProfileNames does — an
  // undefined/empty id in `key` would otherwise stringify to an empty
  // segment via Array.join, which `fetchProfileNames` would also catch, but
  // filtering here too keeps a bad id from ever entering the cache key.
  const key = Array.from(new Set(userIds.filter(Boolean))).sort().join(',');
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
