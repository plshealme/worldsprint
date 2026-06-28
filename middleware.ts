import { NextResponse, type NextRequest } from "next/server";

const androidShellOrigin = "https://appassets.androidplatform.net";
const productionOrigin = "https://43.128.23.159.sslip.io";
const allowedOrigins = new Set([androidShellOrigin, productionOrigin]);

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const allowOrigin = allowedOrigins.has(origin) ? origin : "";

  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(allowOrigin),
    });
  }

  const response = NextResponse.next();
  const headers = corsHeaders(allowOrigin);
  headers.forEach((value, key) => {
    response.headers.set(key, value);
  });
  return response;
}

function corsHeaders(allowOrigin: string) {
  const headers = new Headers();
  if (allowOrigin) {
    headers.set("Access-Control-Allow-Origin", allowOrigin);
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  headers.set("Vary", "Origin");
  return headers;
}

export const config = {
  matcher: ["/api/auth/:path*", "/api/admin/:path*"],
};
