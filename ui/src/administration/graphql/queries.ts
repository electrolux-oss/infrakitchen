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

export const GENERAL_SETTINGS_QUERY = `
  query GeneralSettings {
    generalSettings {
      name
      bannerEnabled
      bannerMessage
      bannerColor
    }
  }
`;

export const DRIFT_SETTINGS_QUERY = `
  query DriftSettings {
    driftSettings {
      enabled
      intervalHours
    }
  }
`;
