import React from "react";

import { PlaceholderDescription } from "../fields/PlaceholderDescription";
import { Label } from "../labels";

interface HclOutputValueProps {
  output: {
    name: string;
    description?: string;
    source?: string;
  };
}

export const HclOutputValue: React.FC<HclOutputValueProps> = ({ output }) => {
  return (
    <div className="mb-4 rounded-surface border border-divider p-4">
      <span className="mr-2 text-body1 font-medium">{output.name}</span>
      {output.source && <Label label={output.source} />}
      <span className="mt-2 block text-caption text-fg-muted">
        {" "}
        {output.description || (
          <PlaceholderDescription className="text-[length:inherit] leading-[inherit]" />
        )}
      </span>
    </div>
  );
};
