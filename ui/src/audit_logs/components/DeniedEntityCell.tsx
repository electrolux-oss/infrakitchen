import { humanizeEntityType } from "../../common/components/entities/Entity";

/**
 * Cell for permission-denial rows: the request was rejected at the gate, so
 * no concrete entity was ever touched and there is no ID to show.
 */
export const DeniedEntityCell = ({
  entityType,
  action,
}: {
  entityType: string;
  action?: string;
}) => (
  <p className="m-0 text-body2 text-error">
    {action ? `${action.charAt(0).toUpperCase()}${action.slice(1)} ` : ""}
    {humanizeEntityType(entityType)} request was denied
  </p>
);
