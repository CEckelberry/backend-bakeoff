export interface Config {
  databaseUrl: string;
  taxServiceUrl: string;
  logLevel: string;
  runtimeName: string;
  listenAddr: string;
  listenPort: number;
}

export function loadConfig(): Config {
  return {
    databaseUrl: Bun.env.DATABASE_URL || '',
    taxServiceUrl: Bun.env.TAX_SERVICE_URL || 'http://tax-service:8080',
    logLevel: Bun.env.LOG_LEVEL || 'info',
    runtimeName: Bun.env.RUNTIME_NAME || 'bun',
    listenAddr: Bun.env.LISTEN_ADDR || '0.0.0.0',
    listenPort: parseInt(Bun.env.LISTEN_PORT || '8080'),
  };
}
