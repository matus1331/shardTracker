function pluralize(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

/** `endAt` is an ISO 8601 UTC datetime, e.g. '2026-07-27T08:00:00Z'. `label` is the event name prefix, e.g. '2x event' or 'Extra Legendary event'. */
export function formatEventCountdown(endAt: string, label: string): string {
  const diffMs = new Date(endAt).getTime() - Date.now();

  if (diffMs <= 0) return `${label} · končí za chvíli`;

  const diffHours = Math.ceil(diffMs / 3_600_000);
  if (diffHours < 24) {
    return `${label} · končí za ${diffHours} ${pluralize(diffHours, 'hodinu', 'hodiny', 'hodin')}`;
  }

  const diffDays = Math.ceil(diffHours / 24);
  return `${label} · končí za ${diffDays} ${pluralize(diffDays, 'den', 'dny', 'dní')}`;
}
