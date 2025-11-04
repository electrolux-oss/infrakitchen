import React from "react";

import { Alert, Button, Typography } from "@mui/material";

import { useEntityProvider } from "../../common/context/EntityContext";
import { ENTITY_ACTION } from "../../utils";

import ResourceStateReviewDialog from "./ResourceStateReviewDialog";

export const ResourceReviewView = () => {
  const { entity, actions } = useEntityProvider();
  const [openStateReview, setOpenStateReview] = React.useState(false);
  const hasCheckStateDifferencePermission =
    actions.includes(ENTITY_ACTION.APPROVE) ||
    actions.includes(ENTITY_ACTION.HAS_TEMPORARY_STATE);

  return (
    <>
      {hasCheckStateDifferencePermission && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => setOpenStateReview(true)}
            >
              Review
            </Button>
          }
        >
          {actions.includes(ENTITY_ACTION.APPROVE) ? (
            <Typography>Review required before proceeding.</Typography>
          ) : (
            <Typography>Temporary changes detected.</Typography>
          )}
        </Alert>
      )}
      <ResourceStateReviewDialog
        open={openStateReview}
        entity={entity as any}
        entity_id={entity.id}
        actions={actions}
        title="Review Changes"
        entity_name={entity._entity_name}
        onClose={() => {
          setOpenStateReview(false);
        }}
      />
    </>
  );
};
