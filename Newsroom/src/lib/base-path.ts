const STATIC_BASE_PATH = process.env.NEXT_PUBLIC_NEWSROOM_BASE_PATH ?? "";

const detectRuntimeBasePath = () => {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.pathname.startsWith("/newsroom") ? "/newsroom" : "";
};

export const getBasePath = () => {
  if (STATIC_BASE_PATH) {
    return STATIC_BASE_PATH;
  }
  return detectRuntimeBasePath();
};

const normalizePath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

export const withBasePath = (path: string, override?: string) => {
  const normalizedPath = normalizePath(path);
  const prefix = override ?? getBasePath();

  if (!prefix) {
    return normalizedPath;
  }

  if (normalizedPath === "/") {
    return prefix || "/";
  }

  return `${prefix}${normalizedPath}`;
};

export const buildApiPath = (path: string, override?: string) => withBasePath(path, override);
