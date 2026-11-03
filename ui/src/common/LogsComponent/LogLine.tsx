import { memo } from "react";

import Ansi from "ansi-to-react";

export const LogLine = memo(({ line }: { line: string }) => (
  <pre className="m-0 text-(length:--text-caption) break-words whitespace-pre-wrap">
    <Ansi>{line || " "}</Ansi>
  </pre>
));
LogLine.displayName = "LogLine";
