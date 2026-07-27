/** `iso` is an ISO 8601 UTC datetime, e.g. '2026-07-24T08:00:00Z'. */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
