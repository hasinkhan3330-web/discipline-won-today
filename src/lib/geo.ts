/**
 * Robust geolocation helpers.
 *
 * The default `getCurrentPosition` call with `enableHighAccuracy: true` is the
 * single biggest source of "Timeout expired" crashes on mobile browsers, so we
 * use a low-accuracy, long-timeout request with a `watchPosition` fallback and
 * never let the underlying API throw an unhandled error.
 */

export type Coords = { lat: number; lng: number; accuracy?: number };

const GEO_OPTS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 30000,
  maximumAge: 60000,
};

function supported() {
  return typeof navigator !== "undefined" && !!navigator.geolocation;
}

function toCoords(p: GeolocationPosition): Coords {
  return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
}

/** Single low-accuracy read; resolves null instead of throwing. */
function once(opts: PositionOptions): Promise<Coords | null> {
  return new Promise(resolve => {
    let settled = false;
    const done = (v: Coords | null) => { if (!settled) { settled = true; resolve(v); } };
    try {
      navigator.geolocation.getCurrentPosition(
        p => done(toCoords(p)),
        () => done(null),
        opts,
      );
    } catch {
      done(null);
    }
    // hard safety net in case the platform never calls either callback
    setTimeout(() => done(null), (opts.timeout ?? 30000) + 2000);
  });
}

/** watchPosition fallback — some devices only ever fire through the watcher. */
function watch(ms: number): Promise<Coords | null> {
  return new Promise(resolve => {
    let id: number | null = null;
    let settled = false;
    const done = (v: Coords | null) => {
      if (settled) return;
      settled = true;
      if (id !== null) { try { navigator.geolocation.clearWatch(id); } catch { /* ignore */ } }
      resolve(v);
    };
    try {
      id = navigator.geolocation.watchPosition(
        p => done(toCoords(p)),
        () => done(null),
        GEO_OPTS,
      );
    } catch {
      done(null);
      return;
    }
    setTimeout(() => done(null), ms);
  });
}

export type GeoResult =
  | { ok: true; coords: Coords }
  | { ok: false; reason: "unsupported" | "denied" | "timeout" };

/** Never throws. Tries a cached read, a fresh read, then a watcher. */
export async function getCoords(): Promise<GeoResult> {
  if (!supported()) return { ok: false, reason: "unsupported" };

  // Permission state is advisory only — some browsers don't implement it.
  try {
    const perms = (navigator as any).permissions;
    if (perms?.query) {
      const st = await perms.query({ name: "geolocation" as PermissionName });
      if (st.state === "denied") return { ok: false, reason: "denied" };
    }
  } catch { /* ignore */ }

  const cached = await once({ ...GEO_OPTS, timeout: 8000, maximumAge: 300000 });
  if (cached) return { ok: true, coords: cached };

  const fresh = await once(GEO_OPTS);
  if (fresh) return { ok: true, coords: fresh };

  const watched = await watch(20000);
  if (watched) return { ok: true, coords: watched };

  return { ok: false, reason: "timeout" };
}

/** Haversine distance in metres. */
export function distanceM(a: Coords, b: Coords) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
