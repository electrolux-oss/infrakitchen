import { useEffect, useState } from "react";

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
  Typography,
} from "@mui/material";

import { useConfig } from "../../../common";
import GradientCircularProgress from "../../../common/GradientCircularProgress";
import { RevisionResponse, RevisionShort } from "../../../revision/types";
import { getDateValue } from "../CommonField";

import { DiffEditor } from "./DiffEditor";

export interface RevisionProps {
  resourceId: string;
  resourceRevision: number;
}

export const Revision = ({ resourceId, resourceRevision }: RevisionProps) => {
  const { ikApi } = useConfig();

  const [revisions, setRevisions] = useState<RevisionShort[]>([]);
  const [selectedRevisionLeft, setSelectedRevisionLeft] = useState<number | "">(
    "",
  );
  const [selectedRevisionRight, setSelectedRevisionRight] = useState<
    number | ""
  >("");
  const [leftRevision, setLeftRevision] = useState<RevisionResponse>();
  const [rightRevision, setRightRevision] = useState<RevisionResponse>();
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
      .get(`revisions/${resourceId}`)
      .then((response) => {
        setRevisions(response);
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
    const nums = revisions.map((r) => r.revision_number).sort((a, b) => a - b);

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
    Promise.all([
      ikApi.get(`revisions/${resourceId}/${selectedRevisionLeft}`),
      ikApi.get(`revisions/${resourceId}/${selectedRevisionRight}`),
    ])
      .then(([leftRes, rightRes]) => {
        setLeftRevision(leftRes);
        setRightRevision(rightRes);
        setDiffLoading(false);
      })
      .catch((err) => {
        setError(err);
        setDiffLoading(false);
      });
  }, [ikApi, resourceId, selectedRevisionLeft, selectedRevisionRight]);

  if (initialLoading) return <GradientCircularProgress />;
  if (error) return <Alert severity="error">{error.toString()}</Alert>;

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
          sx={{ mt: 2, mb: 0, ml: 1 }}
          title={
            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 2,
                p: 1,
              }}
            >
              <Difference fontSize="small" sx={{ mt: 0.75 }} />
              <FormControl>
                <InputLabel>From</InputLabel>
                <Select
                  label="From"
                  variant="outlined"
                  value={String(selectedRevisionLeft)}
                  onChange={handleChangeLeft}
                  sx={{ minWidth: 180 }}
                  renderValue={(v) => {
                    const r = revisions.find(
                      (r) => String(r.revision_number) === v,
                    );
                    return r
                      ? `v${r.revision_number} - ${getDateValue(r.created_at)}`
                      : v;
                  }}
                >
                  {revisions.map((r) => (
                    <MenuItem key={r.id} value={String(r.revision_number)}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          v{r.revision_number}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {getDateValue(r.created_at)}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton
                size="small"
                onClick={handleSwap}
                title="Swap revisions"
                sx={{ mt: 0.75 }}
              >
                <SwapHoriz fontSize="small" />
              </IconButton>
              <FormControl>
                <InputLabel>To</InputLabel>
                <Select
                  label="To"
                  variant="outlined"
                  value={String(selectedRevisionRight)}
                  onChange={handleChangeRight}
                  sx={{ minWidth: 180 }}
                  renderValue={(v) => {
                    const r = revisions.find(
                      (r) => String(r.revision_number) === v,
                    );
                    return r
                      ? `v${r.revision_number} - ${getDateValue(r.created_at)}`
                      : v;
                  }}
                >
                  {revisions.map((r) => (
                    <MenuItem key={r.id} value={String(r.revision_number)}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          v{r.revision_number}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {getDateValue(r.created_at)}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          }
        />
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
