import { useEffect } from "react";

/** Runs `effect` once on mount (and its cleanup on unmount). */
export const useEffectOnce = (effect: () => void | (() => void)) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
};
