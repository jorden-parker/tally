import { NextResponse, type NextRequest } from "next/server";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const ALLOWED_FETCH_SITES = new Set(["same-origin", "none"]);

function hostName(host: string | null): string | null {
  if (!host) return null;
  return host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
}

function isLoopback(host: string | null): boolean {
  const name = hostName(host);
  return name !== null && LOOPBACK_HOSTS.has(name);
}

function originHost(origin: string | null): string | null {
  if (!origin || !URL.canParse(origin)) return null;
  return new URL(origin).host;
}

function isReadMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

function isSameOriginJson(request: NextRequest): boolean {
  const host = request.headers.get("host");
  const sameOrigin = originHost(request.headers.get("origin")) === host;
  const json = request.headers.get("content-type")?.startsWith("application/json") ?? false;
  return sameOrigin && json;
}

function isCrossSiteFetch(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  return fetchSite !== null && !ALLOWED_FETCH_SITES.has(fetchSite);
}

function isAllowedRequest(request: NextRequest): boolean {
  if (isCrossSiteFetch(request)) return false;
  return isReadMethod(request.method) || isSameOriginJson(request);
}

export function proxy(request: NextRequest) {
  if (!isLoopback(request.headers.get("host")) || !isAllowedRequest(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}
