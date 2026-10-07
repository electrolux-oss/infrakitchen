import React from "react";

import { Chip, Typography, useTheme } from "@mui/material";

import { SourceConfigResponse } from "../../../source_code_versions/types";
import { getValidationSummary } from "../../../source_code_versions/utils/validationSummary";
import { solidChipColorSx } from "../../utils/softChip";
import { CodeBlock } from "../code/CodeBlock";
import { PlaceholderText } from "../fields/PlaceholderDescription";
import { VariableCard } from "../fields/VariableCard";

type HclInputVariableData = SourceConfigResponse & {
  source?: string;
};

interface HclInputVariableProps {
  variable: HclInputVariableData;
}

export const HclInputVariable: React.FC<HclInputVariableProps> = ({
  variable,
}) => {
  const theme = useTheme();
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
        <CodeBlock sx={{ color: defaultValue ? "success.main" : "error.main" }}>
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
            <Chip
              label={validationSummary}
              sx={{ ml: 1, ...solidChipColorSx("success")(theme) }}
            />
          )}
          {variable.restricted && (
            <Chip
              label="restricted"
              sx={{ ml: 1, ...solidChipColorSx("warning")(theme) }}
            />
          )}
          {variable.sensitive && (
            <Chip
              label="sensitive"
              sx={{ ml: 1, ...solidChipColorSx("secondary")(theme) }}
            />
          )}
        </>
      }
      footer={
        variable.source && (
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", display: "block", mt: 0.5 }}
          >
            source: {variable.source}
          </Typography>
        )
      }
    >
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        Default
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {formatDefaultValue(variable.default)}
      </Typography>
    </VariableCard>
  );
};
