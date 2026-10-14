import { Chip, Grid, Link, Stack, Typography } from "@mui/material";

import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { Entity } from "../../common/components/entities/Entity";
import { CommonField } from "../../common/components/fields/CommonField";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { ToolDetail, toolStatus, formatToolSize } from "../types";

export interface ToolSidebarProps {
  tool: ToolDetail;
}

/**
 * GitHub-style right sidebar for the tool detail page: groups the tool's
 * status, binary details and history so the main column can focus on the
 * resources and executors that use it.
 */
export const ToolSidebar = ({ tool }: ToolSidebarProps) => (
  <EntitySidebar ariaLabel="Tool details">
    <SidebarSection title="Status">
      <Grid size={12}>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <StatusChip status={toolStatus(tool)} />
          {tool.isDefault && (
            <Chip size="small" label="default" color="primary" />
          )}
        </Stack>
      </Grid>
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
    </SidebarSection>

    <SidebarSection title="Binary">
      <CommonField name="Platform" value={`${tool.os}/${tool.arch}`} size={6} />
      <CommonField name="Size" value={formatToolSize(tool.size)} size={6} />
      <CommonField name="Executable" value={tool.executable} size={12} />
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
    </SidebarSection>

    <SidebarSection title="Details">
      <CommonField
        name="Added by"
        value={
          tool.creator ? (
            <Entity entity={{ ...tool.creator, entityType: "user" }} />
          ) : null
        }
        size={12}
      />
      <CommonField
        name="Created"
        value={<RelativeTime date={tool.createdAt} />}
        size={6}
      />
      <CommonField
        name="Last Updated"
        value={tool.updatedAt ? <RelativeTime date={tool.updatedAt} /> : null}
        size={6}
      />
    </SidebarSection>
  </EntitySidebar>
);
