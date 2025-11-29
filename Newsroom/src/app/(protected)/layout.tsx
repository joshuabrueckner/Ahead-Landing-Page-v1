import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

const AUTH_COOKIE_NAME = "newsroom_auth";
const STATIC_BASE_PATH = process.env.NEXT_PUBLIC_NEWSROOM_BASE_PATH?.replace(/\/$/, "") ?? "";

function getRequestedPath() {
  const headerList = headers();
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

function deriveBasePath(requestedPath: string) {
  if (STATIC_BASE_PATH) {
    return STATIC_BASE_PATH;
  }
  return requestedPath.startsWith("/newsroom") ? "/newsroom" : "";
}

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const cookieStore = cookies();
  const authCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (authCookie === "granted") {
    return <>{children}</>;
  }

  const requestedPath = getRequestedPath();
  const basePath = deriveBasePath(requestedPath);
  const searchSuffix = requestedPath ? `?from=${encodeURIComponent(requestedPath)}` : "";
  const passwordPath = basePath ? `${basePath}/password` : "/password";

  redirect(`${passwordPath}${searchSuffix}`);
}
