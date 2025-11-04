import { ReactNode } from "react";

import {
  Box,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Typography,
} from "@mui/material";

export const PropertyCard = (props: {
  title?: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) => {
  const { title = "Properties", subtitle, children, actions } = props;
  return (
    <Card
      sx={{
        width: "100%",
        mb: 4,
      }}
    >
      <CardHeader
        title={
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Typography variant="h5" component="h2">
              {title}
            </Typography>
          </Box>
        }
        subheader={subtitle}
      />
      <CardContent>{children}</CardContent>
      <CardActions sx={{ justifyContent: "center", mt: 2 }}>
        {actions}
      </CardActions>
    </Card>
  );
};
