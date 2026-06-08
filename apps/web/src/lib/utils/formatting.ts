export function formatLatency(ms: number): string {
  if (ms < 0 || !isFinite(ms)) return '—';
  if (ms < 1) return `${(ms * 1000).toFixed(1)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(3)}s`;
}

export function formatRPS(rps: number): string {
  if (rps < 0 || !isFinite(rps)) return '—';
  if (rps >= 1_000_000) return `${(rps / 1_000_000).toFixed(2)}M rps`;
  if (rps >= 1_000) return `${(rps / 1_000).toFixed(2)}K rps`;
  return `${rps.toFixed(0)} rps`;
}

export function formatMoney(value: number, currency: string = '$'): string {
  if (value < 0 || !isFinite(value)) return '—';
  if (value >= 1_000_000) return `${currency}${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${currency}${(value / 1_000).toFixed(2)}K`;
  return `${currency}${value.toFixed(2)}`;
}

export function formatPercent(value: number, decimals: number = 1): string {
  if (value < 0 || !isFinite(value)) return '—';
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number): string {
  if (value < 0 || !isFinite(value)) return '—';
  return value.toLocaleString('en-US');
}

export function formatDuration(ms: number): string {
  if (ms < 0 || !isFinite(ms)) return '—';
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)}m`;
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}
