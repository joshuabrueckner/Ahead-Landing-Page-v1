import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

const AUTH_COOKIE_NAME = "newsroom_auth";
const STATIC_BASE_PATH = process.env.NEXT_PUBLIC_NEWSROOM_BASE_PATH?.replace(/\/$/, "") ?? "";
const PROXY_BASE_PATH = process.env.NEWSROOM_PROXY_BASE_PATH?.replace(/\/$/, "") ?? "/newsroom";
const PROXY_HOSTS = process.env.NEWSROOM_PROXY_HOSTS?.split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean) ?? [];

function getRequestedPath(headerList: Headers) {
  const candidates = [
    headerList.get("x-invoke-path"),
    headerList.get("x-forwarded-uri"),
    headerList.get("x-middleware-pathname"),
    headerList.get("x-next-pathname"),
    headerList.get("next-url"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      if (candidate.includes("://")) {
        const url = new URL(candidate);
        return url.pathname + url.search;
      }
    } catch (error) {
      continue;
    }
    if (candidate.startsWith("/")) {
      return candidate;
    }
    return `/${candidate}`;
  }

  return "/";
}

function deriveBasePath(requestedPath: string, host: string) {
  if (STATIC_BASE_PATH) {
    return STATIC_BASE_PATH;
  }

  if (PROXY_HOSTS.length && PROXY_HOSTS.includes(host)) {
    return PROXY_BASE_PATH;
  }

  if (requestedPath.startsWith(PROXY_BASE_PATH)) {
    return PROXY_BASE_PATH;
  }

  if (requestedPath.startsWith("/newsroom")) {
    return "/newsroom";
  }

  return "";
}

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const headerList = headers();
  const cookieStore = cookies();
  const authCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (authCookie === "granted") {
    return <>{children}</>;
  }

  const requestedPath = getRequestedPath(headerList);
  const host = headerList.get("host")?.toLowerCase() ?? "";
  const basePath = deriveBasePath(requestedPath, host);
  const searchSuffix = requestedPath ? `?from=${encodeURIComponent(requestedPath)}` : "";
  const passwordPath = basePath ? `${basePath}/password` : "/password";

  redirect(`${passwordPath}${searchSuffix}`);
}
