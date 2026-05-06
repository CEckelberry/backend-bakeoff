export function logJSON(data: Record<string, any>): void {
  console.log(JSON.stringify(data));
}

export function createRequestLogger(requestId: string, runtime: string) {
  return {
    logRequest: (method: string, path: string, status: number, durationMs: number) => {
      logJSON({
        request_id: requestId,
        method,
        path,
        status,
        duration_ms: Math.round(durationMs),
        runtime,
        timestamp: new Date().toISOString(),
      });
    },
  };
}
