import { useEffect, useMemo, useState } from "react";

function getDeviceFromWidth(width) {
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

/**
 * Device-aware breakpoint hook.
 * - mobile: < 640px
 * - tablet: 640px – 1023px
 * - desktop: >= 1024px
 *
 * Updates on window resize.
 */
export const useDevice = () => {
  const initial = useMemo(() => {
    if (typeof window === "undefined") return "desktop";
    return getDeviceFromWidth(window.innerWidth);
  }, []);

  const [device, setDevice] = useState(initial);

  useEffect(() => {
    const handleResize = () => setDevice(getDeviceFromWidth(window.innerWidth));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return device;
};

