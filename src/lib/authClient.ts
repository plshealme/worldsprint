import { readJson, removeKey, scopedKey, setActiveUserId, writeJson } from "@/lib/storage";
import type { UserProfile } from "@/types/user";

const activeProfileStorageKey = "activeProfile";
const accessTokenStorageKey = "supabaseAccessToken";

interface AuthApiResponse {
  ok?: boolean;
  profile?: UserProfile;
  accessToken?: string;
  error?: string;
}

export async function postAuthProfile(path: string, payload: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  const data = (await response.json().catch(() => null)) as AuthApiResponse | null;

  if (!response.ok || !data?.ok || !data.profile) {
    throw new Error(data?.error ?? "认证服务暂不可用。");
  }

  persistAuthProfile(data.profile, data.accessToken);
  return data.profile;
}

export function persistAuthProfile(profile: UserProfile, accessToken?: string) {
  writeJson(scopedKey(profile.id, "profile"), profile);
  writeJson(activeProfileStorageKey, profile);
  setActiveUserId(profile.id);
  if (accessToken) {
    writeJson(accessTokenStorageKey, accessToken);
  }
}

export function getStoredAccessToken() {
  return readJson<string>(accessTokenStorageKey, "");
}

export function clearStoredAccessToken() {
  removeKey(accessTokenStorageKey);
}

export function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const accessToken = getStoredAccessToken();
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? "include",
  });
}
