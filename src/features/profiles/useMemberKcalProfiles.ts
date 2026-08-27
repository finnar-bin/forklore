import { useEffect, useState } from "react";
import { fetchMemberKcalProfiles, type MemberKcalProfile } from "./api";

// Same shape as useProfileNames — keyed on a sorted, deduped join of the ids
// rather than the array itself, for the same "callers pass a freshly-mapped
// array every render" reason.
export function useMemberKcalProfiles(
  userIds: string[],
): Record<string, MemberKcalProfile> {
  const key = Array.from(new Set(userIds.filter(Boolean)))
    .sort()
    .join(",");
  const [profiles, setProfiles] = useState<Record<string, MemberKcalProfile>>(
    {},
  );

  useEffect(() => {
    if (!key) {
      setProfiles({});
      return;
    }
    let cancelled = false;
    fetchMemberKcalProfiles(key.split(","))
      .then((result) => {
        if (!cancelled) setProfiles(result);
      })
      .catch(() => {
        if (!cancelled) setProfiles({});
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return profiles;
}
