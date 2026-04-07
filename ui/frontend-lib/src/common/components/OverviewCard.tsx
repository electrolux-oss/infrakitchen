import { ReactNode } from "react";

import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  SxProps,
  Theme,
} from "@mui/material";

export interface OverviewCardProps {
  name?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  chip?: string;
  sx?: SxProps<Theme>;
}

export const OverviewCard = (props: OverviewCardProps) => {
  const { name, description, children, actions, icon, chip, sx } = props;
  return (
    <Card sx={{ width: "100%", ...sx }}>
      {(name || description || actions || chip) && (
        <CardHeader
          title={
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              {icon}
              {name}
              {chip && (
                <Chip
                  label={chip.toUpperCase()}
                  size="small"
                  variant="outlined"
                  color="info"
                />
              )}
            </Box>
          }
          subheader={description}
          action={actions}
          sx={{
            "& .MuiCardHeader-content": {
              "& .MuiCardHeader-subheader": {
                marginTop: 1,
              },
            },
          }}
        />
      )}
      <CardContent>
        <Grid container spacing={2}>
          {children}
        </Grid>
      </CardContent>
    </Card>
  );
};
