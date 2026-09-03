import { ReactNode } from "react";

import {
  Card,
  CardActions,
  CardContent,
  CardHeader,
} from "@mui/material";

export const PropertyCard = (props: {
  title?: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  action?: ReactNode;
}) => {
  const { title = "Properties", subtitle, children, actions, action } = props;
  return (
    <Card
      sx={{
        width: "100%",
        mb: 2,
      }}
    >
      <CardHeader title={title} subheader={subtitle} action={action} />
      <CardContent>{children}</CardContent>
      <CardActions sx={{ justifyContent: "center", mt: 2 }}>
        {actions}
      </CardActions>
    </Card>
  );
};
