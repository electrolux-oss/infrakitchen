import { Box, Checkbox, Typography, FormControlLabel } from "@mui/material";

import { getTextValue } from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { DependencyVariable, ResourceResponse } from "../types";

export interface DependencyConfigurationProps {
  resource: ResourceResponse;
}

const getDependencyVariables = (variables: DependencyVariable[]) => {
  if (!variables || variables.length === 0) {
    return getTextValue("-");
  }
  return (
    <Box sx={{ ml: 3 }}>
      {variables.map((variable) => (
        <Box
          key={variable.name}
          sx={{
            display: "grid",
            gridTemplateColumns: "300px 150px 200px",
            alignItems: "center",
            columnGap: 5,
          }}
        >
          <Typography
            variant="body2"
            sx={{ color: "text.primary" }}
            fontWeight="bold"
          >
            {variable.name}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {variable.value}
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={variable.inherited_by_children ?? false}
                  disableRipple
                  sx={{
                    pointerEvents: "none",
                    cursor: "default",
                  }}
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  Inherited By Children
                </Typography>
              }
              sx={{
                pointerEvents: "none",
                cursor: "default",
              }}
            />
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export const DependencyConfiguration = ({
  resource,
}: DependencyConfigurationProps) => {
  return (
    <Box sx={{ gap: 2, display: "flex", flexDirection: "column" }}>
      <OverviewCard
        name={
          <Typography variant="h5" component="h2">
            Tags
          </Typography>
        }
      >
        {getDependencyVariables(resource.dependency_tags)}
      </OverviewCard>
      <OverviewCard
        name={
          <Typography variant="h5" component="h2">
            Configs
          </Typography>
        }
      >
        {getDependencyVariables(resource.dependency_config)}
      </OverviewCard>
    </Box>
  );
};
