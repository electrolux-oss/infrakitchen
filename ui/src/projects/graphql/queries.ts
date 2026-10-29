export const PROJECT_DRIFT_QUERY = `
  query ProjectDrift($projectId: UUID!) {
    driftReport(projectId: $projectId) {
      overallScore
      projects {
        projectId
        projectName
        score
        total
        inSync
        drifted
        error
        unknown
      }
    }
  }
`;
