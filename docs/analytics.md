# Analytics formulas (v0.1)

OpenIbex analytics are intentionally simple and transparent.

Terminology:

- **Load**: a generic training-load score (not a proprietary metric).
- **Fitness / Fatigue / Freshness**: generic rolling averages of Load.

## Weekly totals

Weekly buckets use **Monday** as the start of week.

For each week we compute:

- `completed_duration_sec`: sum of `activities.duration_sec` in the week (missing values count as 0)
- `completed_distance_m`: sum of `activities.distance_m` in the week
- `completed_elevation_gain_m`: sum of `activities.elevation_gain_m` in the week
- `completed_load`: sum of per-activity load in the week
- `planned_duration_sec`: sum of `planned_workouts.planned_duration_sec` in the week
- `planned_distance_m`: sum of `planned_workouts.planned_distance_m` in the week
- `planned_load`: sum of `planned_workouts.planned_load` in the week

## Load

If an activity has an explicit `activities.load_score`, use it.

Otherwise use this fallback approximation:

```text
load = duration_hours * intensity_factor(sport) * 100
duration_hours = duration_sec / 3600
```

Default sport intensity factors:

| Sport | intensity_factor |
|---|---:|
| Bike | 0.60 |
| Run | 0.70 |
| Swim | 0.65 |
| Strength | 0.50 |
| Other | 0.50 |

## Fitness / Fatigue / Freshness

For each day:

```text
daily_load = sum(activity_load for that local date)
fitness  = rolling_average(daily_load, long_window_days=42)
fatigue  = rolling_average(daily_load, short_window_days=7)
freshness = fitness - fatigue
```

This uses a simple rolling average (not EWMA) for v0.1.

## Compliance

Compliance is computed only for **linked** planned↔completed pairs (`workout_links`).

Per-linked-pair ratios:

```text
duration_compliance = completed_duration / planned_duration
distance_compliance = completed_distance / planned_distance
load_compliance = completed_load / planned_load
```

Weekly compliance aggregates linked pairs by totals (not by averaging ratios):

```text
weekly_duration_compliance = sum(completed_duration) / sum(planned_duration)
weekly_distance_compliance = sum(completed_distance) / sum(planned_distance)
weekly_load_compliance = sum(completed_load) / sum(planned_load)
```

If the planned total is 0 (or missing), compliance is shown as `—`.

