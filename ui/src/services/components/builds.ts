import { GqlServiceBuild } from "../graphql";

const ACTIVE_BUILD_STATUSES = ["queued", "in_progress"];

// Same rule as IMAGE_TAG_RE in server/src/application/service_builds/schema.py
export const IMAGE_TAG_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;

// Same rule as IMAGE_REPOSITORY_RE in server/src/application/services/schema.py
export const IMAGE_REPOSITORY_RE =
  /^[a-z0-9]+(?:(?:\.|_|__|-+)[a-z0-9]+)*(?:\/[a-z0-9]+(?:(?:\.|_|__|-+)[a-z0-9]+)*)*$/;

export const isActiveStatus = (status: string | undefined) =>
  !!status && ACTIVE_BUILD_STATUSES.includes(status.toLowerCase());

export const isActiveBuild = (build: GqlServiceBuild | undefined) =>
  isActiveStatus(build?.status);

export const formatDuration = (build: GqlServiceBuild) => {
  if (!build.startedAt) return "";
  const end = build.finishedAt ? new Date(build.finishedAt) : new Date();
  const seconds = Math.max(
    0,
    Math.round((end.getTime() - new Date(build.startedAt).getTime()) / 1000),
  );
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};
