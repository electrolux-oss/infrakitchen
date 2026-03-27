import { useCallback, useState } from "react";

function read(): URLSearchParams {
  return new URLSearchParams(window.location.hash.slice(1));
}

export function useHashParams(): [
  URLSearchParams,
  (next: URLSearchParams) => void,
] {
  const [params, setParams] = useState(read);

  const set = useCallback((next: URLSearchParams) => {
    window.location.hash = next.toString();
    setParams(next);
  }, []);

  return [params, set];
}
