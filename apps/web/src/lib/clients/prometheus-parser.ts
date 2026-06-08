export interface ParsedMetric {
  name: string;
  labels: Record<string, string>;
  value: number;
}

export function parsePrometheus(text: string): Record<string, number> {
  const result: Record<string, number> = {};
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*){([^}]*)}\s+([0-9eE.+-]+)$/);
    if (match) {
      const [, name, labelsStr, value] = match;
      const labels: Record<string, string> = {};
      labelsStr.split(',').forEach(pair => {
        const [k, v] = pair.split('=').map(s => s.replace(/"/g, ''));
        if (k && v) labels[k] = v;
      });

      const key = `${name}{${Object.entries(labels).sort().map(([k,v]) => `${k}="${v}"`).join(',')}}`;
      result[key] = parseFloat(value);
    }
  }
  return result;
}