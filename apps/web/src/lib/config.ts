export const CONFIG = {
  ROUTER_URL: '/api/router',
  PROMETHEUS_URL: '/api/prometheus/query',
  UPDATE_INTERVAL: 2000,
  CHART_WINDOW_SECONDS: 60,
  STRESS_MODE_COOLDOWN: 60000,
} as const;

export const RUNTIME_COLORS: Record<string, { primary: string; light: string; dark: string }> = {
  go: { primary: '#5DCAA5', light: '#B8E8D4', dark: '#3A9E78' },
  rust: { primary: '#FAC775', light: '#FDE4B8', dark: '#D4A04A' },
  rails: { primary: '#EF4444', light: '#FCA5A5', dark: '#B91C1C' },
  node: { primary: '#AFA9EC', light: '#D8D5F7', dark: '#857FD4' },
  python: { primary: '#ED93B1', light: '#F7C8D8', dark: '#C96A8C' },
  php: { primary: '#7F77DD', light: '#C0BDF5', dark: '#5A52C4' },
};

export const ALL_RUNTIMES: Array<keyof typeof RUNTIME_COLORS> = [
  'go',
  'rust',
  'rails',
  'node',
  'python',
  'php',
];
