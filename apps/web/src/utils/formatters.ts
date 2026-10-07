export function formatDate(isoString?: string | null): string {
  if (!isoString) return 'N/A';
  try {
    return new Date(isoString).toLocaleString();
  } catch {
    return isoString;
  }
}

export function formatDuration(seconds?: number | null): string {
  if (seconds === undefined || seconds === null) return '0s';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const remSec = Math.round(seconds % 60);
  return `${mins}m ${remSec}s`;
}

export function formatSeverityLabel(severity: string): string {
  return severity.toUpperCase();
}
