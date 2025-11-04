import { Box, Checkbox, Typography, FormControlLabel } from "@mui/material";

import { getTextValue } from "../../common/components/CommonField";
import { PropertyCollapseCard } from "../../common/components/PropertyCollapseCard";
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
    <PropertyCollapseCard
      title="Dependency Configuration"
      subtitle="Configuration inherited from dependencies"
      id="resource-dependency-config"
    >
      <Box sx={{ gap: 2, display: "flex", flexDirection: "column" }}>
        <PropertyCollapseCard
          title={
            <Typography variant="h5" component="h2">
              Tags
            </Typography>
          }
          id="resource-dependency-tags"
        >
          {getDependencyVariables(resource.dependency_tags)}
        </PropertyCollapseCard>
        <PropertyCollapseCard
          title={
            <Typography variant="h5" component="h2">
              Configs
            </Typography>
          }
          id="resource-dependency-configs"
        >
          {getDependencyVariables(resource.dependency_config)}
        </PropertyCollapseCard>
      </Box>
    </PropertyCollapseCard>
  );
};
