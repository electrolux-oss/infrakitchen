import { useState } from "react";

/**
 * State that follows `value` when the caller passes one (controlled) and
 * lives here otherwise. The setter always reports through `onChange`.
 */
export function useControllable<T>(
  value: T | undefined,
  initial: T,
  onChange: ((value: T) => void) | undefined,
): [T, (next: T) => void] {
  const [inner, setInner] = useState(initial);
  const current = value === undefined ? inner : value;
  return [
    current,
    (next: T) => {
      setInner(next);
      onChange?.(next);
    },
  ];
}
