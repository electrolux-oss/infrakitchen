import { gql } from "graphql-request";

export const WORKFLOW_QUERY = gql`
  query Workflow($id: UUID!) {
    workflow(id: $id) {
      id
      action
      wiringSnapshot
      status
      errorMessage
      createdBy
      creator {
        id
        identifier
      }
      steps {
        id
        workflowId
        templateId
        template {
          id
          name
          cloudResourceTypes
        }
        resourceId
        resource {
          id
          name
          template {
            id
            name
          }
        }
        sourceCodeVersionId
        sourceCodeVersion {
          id
          sourceCodeVersion
          sourceCodeBranch
        }
        parentResourceIds
        parentResources {
          id
          name
        }
        integrationIds {
          id
          name
          integrationProvider
        }
        secretIds {
          id
          name
          secretProvider
        }
        storageId
        position
        status
        errorMessage
        resolvedVariables
        startedAt
        completedAt
      }
      startedAt
      completedAt
      createdAt
    }
  }
`;

export const WORKFLOWS_QUERY = gql`
  query Workflows($filter: JSON, $sort: [String!], $range: [Int!]) {
    workflows(filter: $filter, sort: $sort, range: $range) {
      id
      action
      status
      errorMessage
      creator {
        id
        identifier
      }
      steps {
        id
        status
      }
      startedAt
      completedAt
      createdAt
    }
  }
`;

export const WORKFLOWS_COUNT_QUERY = gql`
  query WorkflowsCount($filter: JSON) {
    workflowsCount(filter: $filter)
  }
`;
