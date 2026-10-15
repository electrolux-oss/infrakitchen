import {
  cloneElement,
  ReactElement,
  Ref,
  RefCallback,
  useEffect,
  useRef,
} from "react";

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

export interface ClickAwayListenerProps {
  onClickAway: (event: globalThis.MouseEvent | TouchEvent) => void;
  children: ReactElement<{ ref?: Ref<HTMLElement> }>;
}

/** Calls onClickAway for clicks outside its single child. */
export function ClickAwayListener({
  onClickAway,
  children,
}: ClickAwayListenerProps) {
  const nodeRef = useRef<HTMLElement | null>(null);
  const handler = useRef(onClickAway);
  handler.current = onClickAway;

  useEffect(() => {
    const listener = (event: globalThis.MouseEvent | TouchEvent) => {
      const node = nodeRef.current;
      if (node && !node.contains(event.target as Node)) handler.current(event);
    };
    document.addEventListener("click", listener);
    document.addEventListener("touchend", listener);
    return () => {
      document.removeEventListener("click", listener);
      document.removeEventListener("touchend", listener);
    };
  }, []);

  const childRef = children.props.ref;
  const ref: RefCallback<HTMLElement> = (node) => {
    nodeRef.current = node;
    setRef(childRef, node);
  };
  return cloneElement(children, { ref });
}
