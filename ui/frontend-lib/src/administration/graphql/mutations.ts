export const UPDATE_FEATURE_FLAG_MUTATION = `
  mutation UpdateFeatureFlag($input: FeatureFlagUpdateInput!) {
    updateFeatureFlag(input: $input) {
      name
      configName
      enabled
      updatedBy
    }
  }
`;

export const RELOAD_FEATURE_FLAGS_MUTATION = `
  mutation ReloadFeatureFlags {
    reloadFeatureFlags {
      status
    }
  }
`;

export const RELOAD_PERMISSIONS_MUTATION = `
  mutation ReloadPermissions {
    reloadPermissions {
      status
    }
  }
`;

export const CREATE_SCHEDULER_MUTATION = `
  mutation CreateScheduler($input: SchedulerJobCreateInput!) {
    createScheduler(input: $input) {
      id
      type
      script
      cron
      createdAt
    }
  }
`;

export const UPDATE_SCHEDULER_MUTATION = `
  mutation UpdateScheduler($id: UUID!, $input: SchedulerJobUpdateInput!) {
    updateScheduler(id: $id, input: $input) {
      id
      type
      script
      cron
      createdAt
    }
  }
`;

export const DELETE_SCHEDULER_MUTATION = `
  mutation DeleteScheduler($id: UUID!) {
    deleteScheduler(id: $id)
  }
`;
