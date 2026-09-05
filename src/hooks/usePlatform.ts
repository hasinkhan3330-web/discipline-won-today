import { useEffect, useState } from "react";
import { detectPlatform, isNativeStore, type AppPlatform } from "@/lib/platform";

/**
 * Runtime platform for billing UI decisions.
 * `null` while detecting — render neutral copy until it resolves so no
 * third-party payment wording can ever flash inside a store build.
 */
export function usePlatform(): { platform: AppPlatform | null; isNative: boolean } {
  const [platform, setPlatform] = useState<AppPlatform | null>(null);

  useEffect(() => {
    let alive = true;
    detectPlatform()
      .then((p) => alive && setPlatform(p))
      .catch(() => alive && setPlatform("web"));
    return () => {
      alive = false;
    };
  }, []);

  return { platform, isNative: platform !== null && isNativeStore(platform) };
}
