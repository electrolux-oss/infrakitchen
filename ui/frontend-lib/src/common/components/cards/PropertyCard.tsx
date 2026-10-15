import { ReactNode } from "react";

import { Card, CardActions, CardContent, CardHeader } from "../../../ui";

export const PropertyCard = (props: {
  title?: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  action?: ReactNode;
}) => {
  const { title = "Properties", subtitle, children, actions, action } = props;
  return (
    <Card className="mb-4 w-full">
      <CardHeader title={title} subheader={subtitle} action={action} />
      <CardContent>{children}</CardContent>
      <CardActions className="mt-4 justify-center">{actions}</CardActions>
    </Card>
  );
};
