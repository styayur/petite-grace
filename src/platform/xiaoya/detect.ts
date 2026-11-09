import { getCourseIdFromLocation } from "./api";

export function isXiaoyaHost(hostname: string): boolean {
  return hostname === "ai-augmented.com" || hostname.endsWith(".ai-augmented.com");
}

export function isXiaoyaCoursePage(location: Pick<Location, "hostname" | "pathname">): boolean {
  return isXiaoyaHost(location.hostname) && Boolean(getCourseIdFromLocation(location));
}
