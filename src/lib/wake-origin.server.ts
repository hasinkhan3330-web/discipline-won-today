import { getRequest } from "@tanstack/react-start/server";

/** Wake-only request check; auth bearer validation remains a separate required boundary. */
export function verifyWakeOrigin() {
  const request = getRequest();
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new Error("Cross-site wake request denied");
  if (origin && origin !== new URL(request.url).origin) throw new Error("Cross-site wake request denied");
}