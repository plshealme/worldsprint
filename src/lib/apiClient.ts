const ANDROID_LOCAL_HOST = "appassets.androidplatform.net";
const DEFAULT_REMOTE_API_ORIGIN = "https://43.128.23.159.sslip.io";

function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function remoteApiOrigin() {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || DEFAULT_REMOTE_API_ORIGIN;
}

export function isAndroidLocalShell() {
  return typeof window !== "undefined" && window.location.hostname === ANDROID_LOCAL_HOST;
}

export function resolveApiUrl(input: RequestInfo | URL) {
  if (typeof input !== "string") {
    return input;
  }

  if (isAbsoluteUrl(input) || !input.startsWith("/api/")) {
    return input;
  }

  return isAndroidLocalShell() ? `${remoteApiOrigin()}${input}` : input;
}
