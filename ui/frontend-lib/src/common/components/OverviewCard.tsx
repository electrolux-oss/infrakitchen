import { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  Grid,
  SxProps,
  Theme,
} from "@mui/material";

export interface OverviewCardProps {
  name?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  sx?: SxProps<Theme>;
}

export const OverviewCard = (props: OverviewCardProps) => {
  const { name, description, children, actions, sx } = props;
  return (
    <Card sx={{ width: "100%", ...sx }}>
      <CardHeader
        title={name}
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
      <CardContent>
        <Grid container spacing={2}>
          {children}
        </Grid>
      </CardContent>
    </Card>
  );
};
