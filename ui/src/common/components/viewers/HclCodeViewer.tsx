import { FC } from "react";

import CodeMirror from "@uiw/react-codemirror";
import { hcl } from "codemirror-lang-hcl";

import { useColorScheme } from "../../../ui";

export interface HclCodeViewerProps {
  value: string;
  readOnly?: boolean;
}

const hclExtensions = [hcl()];

export const HclCodeViewer: FC<HclCodeViewerProps> = ({
  value,
  readOnly = true,
}) => {
  const { resolvedMode } = useColorScheme();

  return (
    <CodeMirror
      value={value}
      theme={resolvedMode}
      extensions={hclExtensions}
      readOnly={readOnly}
      editable={!readOnly}
      basicSetup={{ foldGutter: true, lineNumbers: true }}
    />
  );
};
