import { useCallback, useEffect, useState } from "react";

/**
 * Measures the height left between an element's top edge and the bottom of
 * the viewport, so a canvas can fill the rest of the screen on a page that
 * has no fixed-height ancestors. Attach the returned `ref` to the element.
 */
export const useFillViewportHeight = ({
  enabled = true,
  bottomOffset = 0,
  minHeight = 0,
}: {
  enabled?: boolean;
  /** Space to keep free below the element (card padding, page gutter). */
  bottomOffset?: number;
  minHeight?: number;
} = {}) => {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState<number>();

  const ref = useCallback((node: HTMLElement | null) => setElement(node), []);

  useEffect(() => {
    if (!enabled || !element) return;

    const measure = () => {
      // Offset from the document top, so scrolling the page between
      // measurements does not change the result.
      const top = element.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(minHeight, window.innerHeight - top - bottomOffset));
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [enabled, element, bottomOffset, minHeight]);

  return { ref, height };
};
