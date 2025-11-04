import { useEffect, useState } from "react";

import { Difference, History } from "@mui/icons-material";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
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
  const [revisionNumbers, setRevisionNumbers] = useState<number[]>([]);
  const [leftRevision, setLeftRevision] = useState<RevisionResponse>();
  const [rightRevision, setRightRevision] = useState<RevisionResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const handleChangeLeft = (event: SelectChangeEvent) => {
    const val = event.target.value;
    setSelectedRevisionLeft(val === "" ? "" : Number(val));
  };
  const handleChangeRight = (event: SelectChangeEvent) => {
    const val = event.target.value;
    setSelectedRevisionRight(val === "" ? "" : Number(val));
  };

  useEffect(() => {
    setLoading(true);
    ikApi
      .get(`revisions/${resourceId}`)
      .then((response) => {
        setRevisions(response);
      })
      .catch((error) => {
        setError(error);
        setLoading(false);
      });
  }, [ikApi, resourceId]);

  useEffect(() => {
    if (!revisions.length) return;
    const nums = revisions.map((r) => r.revision_number).sort((a, b) => a - b);
    setRevisionNumbers(nums);

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
    if (!selectedRevisionLeft || !selectedRevisionRight) return;
    setLoading(true);
    Promise.all([
      ikApi.get(`revisions/${resourceId}/${selectedRevisionLeft}`),
      ikApi.get(`revisions/${resourceId}/${selectedRevisionRight}`),
    ])
      .then(([leftRes, rightRes]) => {
        setLeftRevision(leftRes);
        setRightRevision(rightRes);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [ikApi, resourceId, selectedRevisionLeft, selectedRevisionRight]);

  if (loading) return <GradientCircularProgress />;
  if (error) return <Alert severity="error">{error.toString()}</Alert>;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        gap: 2,
        mt: 2,
      }}
    >
      <Box
        sx={{
          width: 350,
          height: 500,
          display: "flex",
          flexDirection: "column",
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
            title={
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 1,
                  p: 2,
                }}
              >
                <History fontSize="small" />
                <Typography variant="body1">Revisions</Typography>
              </Box>
            }
          />
          <CardContent sx={{ overflow: "auto", p: 0 }}>
            <List sx={{ p: 0 }}>
              {revisions.map((rev: RevisionShort) => (
                <Box key={rev.revision_number}>
                  <ListItem alignItems="flex-start">
                    <ListItemText
                      primary={
                        <Typography
                          component="span"
                          variant="body1"
                          fontWeight="bold"
                        >
                          {`v${rev.revision_number}`}
                        </Typography>
                      }
                      secondary={
                        <>
                          <Typography
                            component="span"
                            variant="body2"
                            color="text.secondary"
                          >
                            {`${getDateValue(rev.created_at)}`}
                          </Typography>
                          <br />
                          {rev.name && (
                            <>
                              <Typography
                                component="span"
                                variant="body1"
                                color="text.primary"
                              >
                                {rev.name}
                              </Typography>
                              <br />
                            </>
                          )}
                          {rev.description && (
                            <Typography
                              component="span"
                              variant="body2"
                              color="text.secondary"
                            >
                              {rev.description}
                            </Typography>
                          )}
                        </>
                      }
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          </CardContent>
        </Card>
        <Card sx={{ p: 1, mt: 2 }}>
          <CardHeader
            title={
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 1,
                  p: 1,
                }}
              >
                <Difference fontSize="small" />
                <Typography variant="body2">Compare</Typography>
              </Box>
            }
          />
          <CardContent sx={{ p: 1, mt: 2 }}>
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth>
                <InputLabel id="left-rev-label">Left revision</InputLabel>
                <Select
                  labelId="left-rev-label"
                  label="Left revision"
                  value={
                    selectedRevisionLeft === ""
                      ? ""
                      : String(selectedRevisionLeft)
                  }
                  onChange={handleChangeLeft}
                >
                  {revisionNumbers.map((v) => (
                    <MenuItem key={v} value={v}>
                      {v}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id="right-rev-label">Right revision</InputLabel>
                <Select
                  labelId="right-rev-label"
                  label="Right revision"
                  value={
                    selectedRevisionRight === ""
                      ? ""
                      : String(selectedRevisionRight)
                  }
                  onChange={handleChangeRight}
                >
                  {revisionNumbers.map((v) => (
                    <MenuItem key={v} value={v}>
                      {v}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </CardContent>
        </Card>
      </Box>
      <Box
        sx={{
          width: 900,
          height: 500,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <Card
          sx={{
            display: "flex",
            flexDirection: "column",
            borderTop: "none",
            minHeight: 0,
            flex: 1,
            p: 0,
          }}
        >
          <CardHeader
            title={
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 1,
                  p: 2,
                }}
              >
                <Difference fontSize="small" />
                <Typography variant="body2">
                  {`v${selectedRevisionLeft} ➔ v${selectedRevisionRight} `}
                </Typography>
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
            {leftRevision && rightRevision ? (
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
    </Box>
  );
};
