import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../../theme/theme';
import { useGroupMembers } from '../groups/useGroupMembers';
import { useMemberKcalProfiles } from '../profiles/useMemberKcalProfiles';
import { MEAL_TYPES, MEAL_TYPE_LABELS } from '../../types/meal';
import { getMealKcalTargets } from '../../types/profile';
import type { LogEntry } from '../../types/log';

// Replaces DailyLog's own "logged vs. daily target" info card on
// /groups/:groupId/log — a personal target is only meaningful per person,
// so a group's shared log shows every member's own target (and optional
// per-meal breakdown) side by side instead of one aggregate number.
export function GroupMemberKcalCard({
  groupId,
  userId,
  entries,
}: {
  groupId: string;
  userId: string | null;
  entries: LogEntry[];
}) {
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;

  const members = useGroupMembers(groupId);
  const profiles = useMemberKcalProfiles((members ?? []).map((member) => member.user_id));
  const loading = members === undefined;

  return (
    <Paper sx={{ p: 2, borderRadius: '14px', boxShadow: tokens.sh2 }}>
      <Typography fontSize={13} fontWeight={600} color="text.secondary" sx={{ mb: loading ? 0 : 1 }}>
        Members' kcal targets
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={20} />
        </Box>
      )}

      <Stack divider={<Divider />} spacing={1.25}>
        {(members ?? []).map((member) => {
          const profile = profiles[member.user_id];
          const loggedToday = entries
            .filter((entry) => entry.logged_by === member.user_id)
            .reduce((sum, entry) => sum + entry.snapshot_kcal, 0);
          const target = profile?.daily_kcal_target ?? null;
          const mealTargets = profile ? getMealKcalTargets(profile) : null;

          return (
            <Stack key={member.user_id} spacing={0.75}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
                <Typography fontSize={13} fontWeight={500} noWrap sx={{ minWidth: 0 }}>
                  {profile?.name ?? 'Loading…'}
                  {member.user_id === userId ? ' (you)' : ''}
                </Typography>
                <Typography fontSize={13} fontWeight={500} color="primary.main" sx={{ flexShrink: 0 }}>
                  {target !== null ? `${loggedToday.toFixed(0)} / ${target} kcal` : `${loggedToday.toFixed(0)} kcal`}
                </Typography>
              </Stack>

              {profile?.meal_breakdown_enabled && mealTargets && (
                <Stack direction="row" justifyContent="space-around">
                  {MEAL_TYPES.map((meal) => {
                    const mealTarget = mealTargets[meal] ?? 0;
                    // `?? null` guards a pre-feature row cached before
                    // meal_type existed — see DailyLog's own identical guard.
                    const consumed = entries
                      .filter((entry) => entry.logged_by === member.user_id && (entry.meal_type ?? null) === meal)
                      .reduce((sum, entry) => sum + entry.snapshot_kcal, 0);
                    const remaining = mealTarget - consumed;
                    return (
                      <Stack key={meal} alignItems="center" spacing={0.25}>
                        <Typography fontSize={10} color="text.secondary">
                          {MEAL_TYPE_LABELS[meal]}
                        </Typography>
                        <Typography fontSize={12} fontWeight={500} color={remaining < 0 ? 'error.main' : undefined}>
                          {remaining >= 0 ? `${remaining.toFixed(0)} left` : `${Math.abs(remaining).toFixed(0)} over`}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              )}
            </Stack>
          );
        })}
      </Stack>

      {!loading && (members ?? []).length === 0 && (
        <Typography fontSize={12} color="text.secondary" textAlign="center">
          No members found.
        </Typography>
      )}
    </Paper>
  );
}
