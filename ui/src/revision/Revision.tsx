import { useEffect, useState } from "react";

import { useConfig } from "../common";
import { DiffEditor } from "../common/components/activity/DiffEditor";
import { getDateValue } from "../common/components/fields/CommonField";
import GradientCircularProgress from "../common/GradientCircularProgress";
import { HeroArrowsRightLeftIcon, HeroDocumentDuplicateIcon } from "../icons";
import {
  Alert,
  IconButton,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Card,
  CardContent,
  CardHeader,
} from "../ui";

import {
  REVISIONS_QUERY,
  REVISION_FIELDS,
  GqlRevisionShort,
  GqlRevision,
} from "./graphql";

export interface RevisionProps {
  resourceId: string;
  resourceRevision: number;
}

export const Revision = ({ resourceId, resourceRevision }: RevisionProps) => {
  const { ikApi } = useConfig();

  const [revisions, setRevisions] = useState<GqlRevisionShort[]>([]);
  const [selectedRevisionLeft, setSelectedRevisionLeft] = useState<number | "">(
    "",
  );
  const [selectedRevisionRight, setSelectedRevisionRight] = useState<
    number | ""
  >("");
  const [leftRevision, setLeftRevision] = useState<GqlRevision>();
  const [rightRevision, setRightRevision] = useState<GqlRevision>();
  const [initialLoading, setInitialLoading] = useState(true);
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleChangeLeft = (event: SelectChangeEvent) => {
    const val = event.target.value;
    setSelectedRevisionLeft(val === "" ? "" : Number(val));
  };
  const handleChangeRight = (event: SelectChangeEvent) => {
    const val = event.target.value;
    setSelectedRevisionRight(val === "" ? "" : Number(val));
  };

  const handleSwap = () => {
    setSelectedRevisionLeft(selectedRevisionRight);
    setSelectedRevisionRight(selectedRevisionLeft);
  };

  useEffect(() => {
    setInitialLoading(true);
    ikApi
      .graphqlRequest<{ revisions: GqlRevisionShort[] }>(REVISIONS_QUERY, {
        entityId: resourceId,
      })
      .then((response) => {
        setRevisions(response.revisions);
      })
      .catch((error) => {
        setError(error);
        setInitialLoading(false);
      });
  }, [ikApi, resourceId]);

  useEffect(() => {
    if (!revisions.length) {
      setInitialLoading(false);
      return;
    }
    const nums = revisions.map((r) => r.revisionNumber).sort((a, b) => a - b);

    if (
      resourceRevision > 1 &&
      nums.includes(resourceRevision) &&
      nums.includes(resourceRevision - 1)
    ) {
      setSelectedRevisionLeft(resourceRevision - 1);
      setSelectedRevisionRight(resourceRevision);
    } else if (nums.length >= 2) {
      setSelectedRevisionLeft(nums[nums.length - 2]);
      setSelectedRevisionRight(nums[nums.length - 1]);
    } else {
      setSelectedRevisionLeft(nums[0]);
      setSelectedRevisionRight(nums[0]);
    }
  }, [revisions, resourceRevision]);

  useEffect(() => {
    if (!selectedRevisionLeft || !selectedRevisionRight) {
      setDiffLoading(false);
      return;
    }
    setDiffLoading(true);
    setInitialLoading(false);
    const query = `
      query RevisionDiff($entityId: UUID!, $leftNum: Int!, $rightNum: Int!) {
        left: revision(entityId: $entityId, revisionNumber: $leftNum) {
          ${REVISION_FIELDS}
        }
        right: revision(entityId: $entityId, revisionNumber: $rightNum) {
          ${REVISION_FIELDS}
        }
      }
    `;
    ikApi
      .graphqlRequest<{ left: GqlRevision; right: GqlRevision }>(query, {
        entityId: resourceId,
        leftNum: selectedRevisionLeft,
        rightNum: selectedRevisionRight,
      })
      .then((res) => {
        setLeftRevision(res.left);
        setRightRevision(res.right);
        setDiffLoading(false);
      })
      .catch((err) => {
        setError(err);
        setDiffLoading(false);
      });
  }, [ikApi, resourceId, selectedRevisionLeft, selectedRevisionRight]);

  if (initialLoading) return <GradientCircularProgress />;
  if (error) return <Alert severity="error">{error.toString()}</Alert>;
  if (!revisions.length) return <Alert severity="info">No revisions</Alert>;

  return (
    <div className="flex h-[80vh] min-h-0 flex-col">
      <Card className="flex min-h-0 flex-1 flex-col p-0">
        <CardHeader
          className="mt-4 mb-0 ml-2"
          title={
            <div className="flex flex-row items-center gap-4 p-2">
              <HeroDocumentDuplicateIcon className="mt-1.5" fontSize="small" />
              <FormControl>
                <InputLabel>From</InputLabel>
                <Select
                  className="min-w-45"
                  label="From"
                  variant="outlined"
                  value={String(selectedRevisionLeft)}
                  onChange={handleChangeLeft}
                  renderValue={(v) => {
                    const r = revisions.find(
                      (r) => String(r.revisionNumber) === v,
                    );
                    return r
                      ? `v${r.revisionNumber} - ${getDateValue(r.createdAt)}`
                      : v;
                  }}
                >
                  {revisions.map((r) => (
                    <MenuItem key={r.id} value={String(r.revisionNumber)}>
                      <div>
                        <p className="m-0 text-body2 font-medium">
                          v{r.revisionNumber}
                        </p>
                        <span className="text-caption text-fg-muted">
                          {getDateValue(r.createdAt)}
                        </span>
                      </div>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton
                className="mt-1.5"
                size="small"
                onClick={handleSwap}
                title="Swap revisions"
              >
                <HeroArrowsRightLeftIcon fontSize="small" />
              </IconButton>
              <FormControl>
                <InputLabel>To</InputLabel>
                <Select
                  className="min-w-45"
                  label="To"
                  variant="outlined"
                  value={String(selectedRevisionRight)}
                  onChange={handleChangeRight}
                  renderValue={(v) => {
                    const r = revisions.find(
                      (r) => String(r.revisionNumber) === v,
                    );
                    return r
                      ? `v${r.revisionNumber} - ${getDateValue(r.createdAt)}`
                      : v;
                  }}
                >
                  {revisions.map((r) => (
                    <MenuItem key={r.id} value={String(r.revisionNumber)}>
                      <div>
                        <p className="m-0 text-body2 font-medium">
                          v{r.revisionNumber}
                        </p>
                        <span className="text-caption text-fg-muted">
                          {getDateValue(r.createdAt)}
                        </span>
                      </div>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          }
        />
        <CardContent className="flex min-h-0 flex-1 overflow-hidden p-2">
          {diffLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <GradientCircularProgress />
            </div>
          ) : leftRevision && rightRevision ? (
            <div className="min-h-0 flex-1">
              <DiffEditor
                originalText={
                  leftRevision?.data
                    ? JSON.stringify(leftRevision.data, null, 2)
                    : "{}"
                }
                modifiedText={
                  rightRevision?.data
                    ? JSON.stringify(rightRevision.data, null, 2)
                    : "{}"
                }
              />
            </div>
          ) : (
            <Alert severity="warning">No revisions found</Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
