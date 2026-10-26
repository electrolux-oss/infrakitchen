import React from "react";

import { SourceConfigResponse } from "../../../source_code_versions/types";
import { getValidationSummary } from "../../../source_code_versions/utils/validationSummary";
import { CodeBlock } from "../code/CodeBlock";
import { PlaceholderText } from "../fields/PlaceholderDescription";
import { VariableCard } from "../fields/VariableCard";
import { Label } from "../labels";

type HclInputVariableData = SourceConfigResponse & {
  source?: string;
};

interface HclInputVariableProps {
  variable: HclInputVariableData;
}

export const HclInputVariable: React.FC<HclInputVariableProps> = ({
  variable,
}) => {
  const validationSummary = getValidationSummary(variable);

  const formatDefaultValue = (defaultValue: any) => {
    if (defaultValue === undefined || defaultValue === null) {
      // No default provided — same empty-value convention as the forms.
      return <PlaceholderText />;
    }

    if (typeof defaultValue === "object") {
      return <CodeBlock>{JSON.stringify(defaultValue, null, 2)}</CodeBlock>;
    }

    if (typeof defaultValue === "string") {
      return <CodeBlock>{defaultValue}</CodeBlock>;
    }

    if (typeof defaultValue === "boolean") {
      return (
        <CodeBlock className={defaultValue ? "text-success" : "text-error"}>
          {String(defaultValue)}
        </CodeBlock>
      );
    }

    return <CodeBlock>{String(defaultValue)}</CodeBlock>;
  };

  return (
    <VariableCard
      name={variable.name}
      required={variable.required}
      type={variable.type}
      description={variable.description}
      chips={
        <>
          {validationSummary && (
            <Label size="small" tone="success" label={validationSummary} />
          )}
          {variable.restricted && (
            <Label size="small" tone="warning" label="restricted" />
          )}
          {variable.sensitive && (
            <Label size="small" tone="secondary" label="sensitive" />
          )}
        </>
      }
      footer={
        variable.source && (
          <span className="mt-1 block text-caption text-fg-muted">
            source: {variable.source}
          </span>
        )
      }
    >
      <span className="text-caption text-fg-muted">Default</span>
      <p className="m-0 text-body2 font-medium">
        {formatDefaultValue(variable.default)}
      </p>
    </VariableCard>
  );
};
