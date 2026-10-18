/**
 * A resource edited while provisioned keeps its changes in the temporary
 * state until they are applied; a non-empty value means it needs a review.
 */
export const hasPendingChanges = (
  row: { tempState?: { value?: Record<string, unknown> | null } | null } | null,
): boolean => {
  const value = row?.tempState?.value;
  return !!value && Object.keys(value).length > 0;
};
