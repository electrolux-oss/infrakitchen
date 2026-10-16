import { REVISION_FIELDS, REVISION_SHORT_FIELDS } from "./fragments";

export const REVISIONS_QUERY = `
  query Revisions($entityId: UUID!) {
    revisions(entityId: $entityId) {
      ${REVISION_SHORT_FIELDS}
    }
  }
`;

export const REVISION_QUERY = `
  query Revision($entityId: UUID!, $revisionNumber: Int!) {
    revision(entityId: $entityId, revisionNumber: $revisionNumber) {
      ${REVISION_FIELDS}
    }
  }
`;
