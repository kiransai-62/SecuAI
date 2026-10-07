import crypto from 'crypto';

export interface RawFinding {
  title: string;
  file?: string;
  line?: number;
  severity?: string;
  description?: string;
}

export function generateFingerprint(title: string, file?: string, line?: number): string {
  const payload = `${title}:${file || ''}:${line || 0}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function normalizeFinding(raw: RawFinding) {
  return {
    fingerprint: generateFingerprint(raw.title, raw.file, raw.line),
    title: raw.title,
    severity: (raw.severity || 'MEDIUM').toUpperCase(),
    file_path: raw.file || null,
    line_start: raw.line || null,
    description: raw.description || raw.title,
  };
}
