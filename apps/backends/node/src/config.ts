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
    databaseUrl: process.env.DATABASE_URL || '',
    taxServiceUrl: process.env.TAX_SERVICE_URL || 'http://tax-service:8080',
    logLevel: process.env.LOG_LEVEL || 'info',
    runtimeName: process.env.RUNTIME_NAME || 'node',
    listenAddr: process.env.LISTEN_ADDR || '0.0.0.0',
    listenPort: parseInt(process.env.LISTEN_PORT || '8080', 10),
  };
}
