import { FC } from "react";

import { useColorScheme } from "@mui/material";
import CodeMirror from "@uiw/react-codemirror";
import { hcl } from "codemirror-lang-hcl";

export interface HclCodeViewerProps {
  value: string;
  readOnly?: boolean;
}

const hclExtensions = [hcl()];

export const HclCodeViewer: FC<HclCodeViewerProps> = ({
  value,
  readOnly = true,
}) => {
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;

  return (
    <CodeMirror
      value={value}
      theme={resolvedMode === "dark" ? "dark" : "light"}
      extensions={hclExtensions}
      readOnly={readOnly}
      editable={!readOnly}
      basicSetup={{ foldGutter: true, lineNumbers: true }}
    />
  );
};
