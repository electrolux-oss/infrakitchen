import { REVISION_SHORT_FIELDS } from "./fragments";

export const REVISIONS_QUERY = `
  query Revisions($entityId: UUID!) {
    revisions(entityId: $entityId) {
      ${REVISION_SHORT_FIELDS}
    }
  }
`;
