import Ansi from "ansi-to-react";

export const LogLine = ({ line }: { line: string }) => (
  <pre
    style={{
      margin: 0,
      fontSize: "0.8rem",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    }}
  >
    <Ansi>{line || " "}</Ansi>
  </pre>
);
