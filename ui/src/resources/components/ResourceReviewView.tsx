import React from "react";

import { useEntityProvider } from "../../common/context/EntityContext";
import { Alert, Button } from "../../ui";
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
          className="items-center py-1 [&>div]:py-0 [&>span]:py-0"
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
          {actions.includes(ENTITY_ACTION.APPROVE)
            ? "Review required before proceeding."
            : "Temporary changes detected. Awaiting owner confirmation."}
        </Alert>
      )}
      <ResourceStateReviewDialog
        open={openStateReview}
        entity={entity as any}
        entity_id={entity.id}
        actions={actions}
        title="Review Changes"
        entity_name={entity.entityName}
        resourceTempState={entity.tempState}
        onClose={() => {
          setOpenStateReview(false);
        }}
      />
    </>
  );
};
