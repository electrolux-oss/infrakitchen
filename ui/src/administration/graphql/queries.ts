export const FEATURE_FLAGS_QUERY = `
  query FeatureFlags {
    featureFlags {
      name
      configName
      enabled
      updatedBy
    }
  }
`;

export const SCHEDULERS_QUERY = `
  query Schedulers {
    schedulers {
      id
      type
      script
      cron
      createdAt
    }
  }
`;

export const DRIFT_SETTINGS_QUERY = `
  query DriftSettings {
    driftSettings {
      enabled
      intervalHours
      batchSize
    }
  }
`;
