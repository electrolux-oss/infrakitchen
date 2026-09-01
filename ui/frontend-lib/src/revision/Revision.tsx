import { useEffect, useMemo, useState } from "react";

import { Difference, SwapHoriz } from "@mui/icons-material";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import { useConfig } from "../common";
import { DiffEditor } from "../common/components/activity/DiffEditor";
import { getDateValue } from "../common/components/CommonField";
import GradientCircularProgress from "../common/GradientCircularProgress";

import {
  REVISIONS_QUERY,
  REVISION_FIELDS,
  GqlRevisionShort,
  GqlRevision,
} from "./graphql";

// Counts added/removed lines between two texts using a longest-common-
// subsequence walk. Kept local so the diff page needs no extra dependency.
const countDiffStats = (original: string, modified: string) => {
  const a = original.split("\n");
  const b = modified.split("\n");
  const n = a.length;
  const m = b.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  let i = 0;
  let j = 0;
  let added = 0;
  let removed = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      removed++;
      i++;
    } else {
      added++;
      j++;
    }
  }
  added += m - j;
  removed += n - i;

  return { added, removed };
};

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
  const [view, setView] = useState<"unified" | "split">("unified");
  const [showDiffOnly, setShowDiffOnly] = useState(false);

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

  const diffStats = useMemo(() => {
    if (!leftRevision || !rightRevision) return null;
    return countDiffStats(
      JSON.stringify(leftRevision.data, null, 2),
      JSON.stringify(rightRevision.data, null, 2),
    );
  }, [leftRevision, rightRevision]);

  if (initialLoading) return <GradientCircularProgress />;
  if (error) return <Alert severity="error">{error.toString()}</Alert>;
  if (!revisions.length) return <Alert severity="info">No revisions</Alert>;

  const revisionSelect = (
    side: "left" | "right",
    value: number | "",
    onChange: (event: SelectChangeEvent) => void,
  ) => (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <InputLabel>{side === "left" ? "From" : "To"}</InputLabel>
      <Select
        label={side === "left" ? "From" : "To"}
        variant="outlined"
        value={String(value)}
        onChange={onChange}
        renderValue={(v) => {
          const r = revisions.find((r) => String(r.revisionNumber) === v);
          return r ? `v${r.revisionNumber} · ${getDateValue(r.createdAt)}` : v;
        }}
      >
        {revisions.map((r) => (
          <MenuItem key={r.id} value={String(r.revisionNumber)}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                v{r.revisionNumber}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {getDateValue(r.createdAt)}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  return (
    <Box
      sx={{
        height: "80vh",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <Card
        sx={{
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          flex: 1,
          p: 0,
        }}
      >
        <CardHeader
          sx={{ px: 2, pt: 1.5, pb: 0.5 }}
          title={
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", md: "row" },
                alignItems: { xs: "flex-start", md: "center" },
                gap: 1.5,
                flexWrap: "wrap",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  mr: 1,
                }}
              >
                <Difference fontSize="small" />
                <Typography
                  variant="h6"
                  component="span"
                  sx={{ fontWeight: 600 }}
                >
                  Revision Diff
                </Typography>
              </Box>
              {revisionSelect("left", selectedRevisionLeft, handleChangeLeft)}
              <IconButton
                size="small"
                onClick={handleSwap}
                title="Swap revisions"
                sx={{ flexShrink: 0 }}
              >
                <SwapHoriz fontSize="small" />
              </IconButton>
              {revisionSelect(
                "right",
                selectedRevisionRight,
                handleChangeRight,
              )}
              <Box sx={{ flexGrow: 1 }} />
              <ToggleButtonGroup
                size="small"
                exclusive
                value={view}
                onChange={(_, next) => {
                  if (next) setView(next);
                }}
              >
                <ToggleButton value="unified">Unified</ToggleButton>
                <ToggleButton value="split">Split</ToggleButton>
              </ToggleButtonGroup>
              <ToggleButton
                size="small"
                value="changes"
                selected={showDiffOnly}
                onChange={() => setShowDiffOnly((prev) => !prev)}
              >
                Only changes
              </ToggleButton>
            </Box>
          }
        />
        {leftRevision && rightRevision && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              px: 2,
              py: 0.75,
              borderBottom: 1,
              borderColor: "divider",
              bgcolor: "background.default",
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              v{leftRevision.revisionNumber} → v{rightRevision.revisionNumber}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {getDateValue(leftRevision.createdAt)} →{" "}
              {getDateValue(rightRevision.createdAt)}
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            {diffStats && (
              <Box sx={{ display: "flex", gap: 2 }}>
                <Typography
                  variant="body2"
                  sx={{ color: "success.main", fontWeight: 600 }}
                >
                  +{diffStats.added}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "error.main", fontWeight: 600 }}
                >
                  −{diffStats.removed}
                </Typography>
              </Box>
            )}
          </Box>
        )}
        <CardContent
          sx={{
            p: 1,
            flex: 1,
            display: "flex",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {diffLoading ? (
            <Box
              sx={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <GradientCircularProgress />
            </Box>
          ) : leftRevision && rightRevision ? (
            <Box sx={{ flex: 1, minHeight: 0 }}>
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
                splitView={view === "split"}
                showDiffOnly={showDiffOnly}
              />
            </Box>
          ) : (
            <Alert severity="warning">No revisions found</Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
