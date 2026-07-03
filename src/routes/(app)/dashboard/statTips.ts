// Plain-language explanations for the calculated training-load metrics,
// surfaced as native browser tooltips (title attributes): what the number is
// and how it should steer planning. Shared because Readiness and Monotony
// each appear in two places on the dashboard (KPI strip + side cards).
export const STAT_TIPS = {
	fitness:
		'Fitness (CTL): your 42-day exponentially-weighted average daily training load. Represents accumulated fitness — it climbs slowly with consistent training. Build it gradually; sharp jumps raise injury and overtraining risk.',
	fatigue:
		'Fatigue (ATL): your 7-day exponentially-weighted average daily load — short-term tiredness. When it stays high, schedule recovery before piling on more hard work.',
	form:
		'Form (TSB) = Fitness − Fatigue. Positive means fresh and rested; negative means you are carrying fatigue (normal during a build block). Aim for positive (roughly +5 to +20) going into key races.',
	weekTss:
		'Week TSS: total Training Stress Score over the last 7 days — your weekly training load. Keep week-to-week changes gradual rather than spiking it.',
	readiness:
		'Readiness: a 0–100 score derived from your Form/TSB (higher = fresher). Low → favour recovery or easy sessions; high → you can absorb intensity or race.',
	monotony:
		'Monotony: average daily load ÷ its 7-day standard deviation. High values (above ~2) mean every day looks the same — vary hard and easy days to bring it down.',
	strain:
		'Strain: weekly load × monotony. High strain is associated with illness, injury, and overtraining. Watch for sharp spikes.'
};
