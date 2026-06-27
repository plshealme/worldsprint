import type { Session } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";

export const AUTH_ACCESS_COOKIE = "wordsprint_access_token";
export const AUTH_REFRESH_COOKIE = "wordsprint_refresh_token";

const baseCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function setAuthCookies(response: NextResponse, session: Session) {
  response.cookies.set(AUTH_ACCESS_COOKIE, session.access_token, {
    ...baseCookieOptions,
    maxAge: Math.max(session.expires_in ?? 3600, 60),
  });

  response.cookies.set(AUTH_REFRESH_COOKIE, session.refresh_token, {
    ...baseCookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(AUTH_ACCESS_COOKIE, "", {
    ...baseCookieOptions,
    maxAge: 0,
  });
  response.cookies.set(AUTH_REFRESH_COOKIE, "", {
    ...baseCookieOptions,
    maxAge: 0,
  });
}
