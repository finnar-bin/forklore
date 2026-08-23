// Selectable windows for the weight-trend chart's range dropdown, widest
// last. The widest one also defines api.ts's fetch window (see
// WEIGHT_HISTORY_DAYS there) so the two can't silently drift apart — a
// future change to this list only needs to happen in one place.
export const WEIGHT_CHART_RANGE_DAYS = [7, 14, 30, 60, 180] as const;

export type WeightChartRangeDays = (typeof WEIGHT_CHART_RANGE_DAYS)[number];

// Requested directly as the default, in place of the widest option — a
// week is the most immediately useful view on first load.
export const DEFAULT_WEIGHT_CHART_RANGE_DAYS: WeightChartRangeDays = 7;
