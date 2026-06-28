export function perfNow() {
  if (typeof performance !== "undefined") {
    return performance.now();
  }
  return Date.now();
}

export function perfLog(message: string, details?: Record<string, unknown>) {
  const payload = details ? ` ${JSON.stringify(details)}` : "";
  console.info(`[perf] ${message}${payload}`);
}
