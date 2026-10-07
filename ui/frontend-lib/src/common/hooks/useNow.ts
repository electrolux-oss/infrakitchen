import { useEffect, useState } from "react";

/**
 * Returns the current epoch-ms timestamp, re-rendering the component every
 * `intervalMs`. Useful for live countdowns (e.g. time until a scheduled run).
 */
export const useNow = (intervalMs = 1000) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
};
