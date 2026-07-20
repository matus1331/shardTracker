function pluralizeDny(n: number): string {
  if (n === 1) return 'den';
  if (n >= 2 && n <= 4) return 'dny';
  return 'dní';
}

/** `endDate` is an ISO date (YYYY-MM-DD). Compares against the client's local today. */
export function formatEventCountdown(endDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(`${endDate}T00:00:00`);
  const diffDays = Math.round((end.getTime() - today.getTime()) / 86_400_000);

  if (diffDays <= 0) return '2x event · končí dnes';
  return `2x event · končí za ${diffDays} ${pluralizeDny(diffDays)}`;
}
