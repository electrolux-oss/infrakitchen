import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { SidebarDetailsSection } from "../../common/components/cards/SidebarDetailsSection";
import { CommonField } from "../../common/components/fields/CommonField";
import { Label } from "../../common/components/labels";
import { StatusLabel } from "../../common/components/labels";
import { Link } from "../../ui";
import { ToolDetail, toolStatus, formatToolSize } from "../types";

export interface ToolSidebarProps {
  tool: ToolDetail;
}

/**
 * Right context sidebar for the tool detail page: groups the tool's
 * status, binary details and history so the main column can focus on the
 * resources and executors that use it.
 */
export const ToolSidebar = ({ tool }: ToolSidebarProps) => (
  <EntitySidebar ariaLabel="Tool details">
    <SidebarSection title="Status">
      <div className="col-span-full">
        <div className="flex flex-row items-center gap-1">
          <StatusLabel status={toolStatus(tool)} />
          {tool.isDefault && <Label tone="primary" label="default" />}
        </div>
      </div>
      {toolStatus(tool) === "error" && (
        <CommonField
          name="Error"
          value={
            <p className="m-0 text-body2 text-error">{tool.errorMessage}</p>
          }
          span="full"
        />
      )}
    </SidebarSection>

    <SidebarSection title="Binary">
      <CommonField
        name="Platform"
        value={`${tool.os}/${tool.arch}`}
        span="half"
      />
      <CommonField name="Size" value={formatToolSize(tool.size)} span="half" />
      <CommonField name="Executable" value={tool.executable} span="full" />
      <CommonField
        name="Source"
        value={
          tool.sourceUrl ? (
            <Link
              className="wrap-anywhere"
              href={tool.sourceUrl}
              target="_blank"
              rel="noopener"
            >
              {tool.sourceUrl}
            </Link>
          ) : null
        }
        span="full"
      />
      <CommonField
        name="SHA256"
        value={
          tool.sha256 ? (
            <p className="m-0 font-mono text-body2 wrap-anywhere">
              {tool.sha256}
            </p>
          ) : null
        }
        span="full"
      />
    </SidebarSection>

    <SidebarDetailsSection
      entity={{
        creator: tool.creator,
        createdAt: tool.createdAt,
        updatedAt: tool.updatedAt,
      }}
      creatorLabel="Added by"
    />
  </EntitySidebar>
);
