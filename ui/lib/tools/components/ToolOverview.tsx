import { Chip, Link, Stack, Typography } from "@mui/material";

import { OverviewCard } from "../../common/components/cards/OverviewCard";
import { Entity } from "../../common/components/entities/Entity";
import { CommonField } from "../../common/components/fields/CommonField";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { IconField } from "../../icons/Icons";
import { ToolDetail, toolLabel, toolStatus, formatToolSize } from "../types";

interface ToolOverviewProps {
  tool: ToolDetail;
}

export const ToolOverview = ({ tool }: ToolOverviewProps) => (
  <OverviewCard name={toolLabel(tool)} icon={IconField(tool.name)}>
    <CommonField
      name="Status"
      value={
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <StatusChip status={toolStatus(tool)} />
          {tool.isDefault && (
            <Chip size="small" label="default" color="primary" />
          )}
        </Stack>
      }
    />
    <CommonField name="Platform" value={`${tool.os}/${tool.arch}`} />
    {toolStatus(tool) === "error" && (
      <CommonField
        name="Error"
        value={
          <Typography sx={{ color: "error.main" }}>
            {tool.errorMessage}
          </Typography>
        }
        size={12}
      />
    )}
    <CommonField name="Executable" value={tool.executable} />
    <CommonField name="Size" value={formatToolSize(tool.size)} />
    <CommonField
      name="Source"
      value={
        tool.sourceUrl ? (
          <Link
            href={tool.sourceUrl}
            target="_blank"
            rel="noopener"
            underline="hover"
            sx={{ overflowWrap: "anywhere" }}
          >
            {tool.sourceUrl}
          </Link>
        ) : null
      }
      size={12}
    />
    <CommonField
      name="SHA256"
      value={
        tool.sha256 ? (
          <Typography
            sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}
          >
            {tool.sha256}
          </Typography>
        ) : null
      }
      size={12}
    />
    <CommonField
      name="Added by"
      value={
        tool.creator ? (
          <Entity entity={{ ...tool.creator, entityType: "user" }} />
        ) : null
      }
    />
    <CommonField
      name="Created"
      value={<RelativeTime date={tool.createdAt} />}
    />
    <CommonField
      name="Last Updated"
      value={tool.updatedAt ? <RelativeTime date={tool.updatedAt} /> : null}
    />
  </OverviewCard>
);
