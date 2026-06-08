import { INTEGRATION_SHORT_FIELDS } from "../../../integrations/graphql/fragments";

export const SLACK_INTEGRATION_QUERY = `
  query SlackIntegrations($filter: JSON) {
    integrations(filter: $filter) {
      ${INTEGRATION_SHORT_FIELDS}
    }
  }
`;

export const MAP_SLACK_MUTATION = `
  mutation MapUserEmailToSlackId($integrationId: UUID, $userId: UUID) {
    mapUserEmailToSlackId(integrationId: $integrationId, userId: $userId) {
      id
      meta { slackId }
    }
  }
`;
