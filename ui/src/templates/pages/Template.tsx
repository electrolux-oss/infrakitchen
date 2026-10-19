import { useParams, useNavigate } from "react-router";

import { useConfig } from "../../common";
import { EntityRefreshButton } from "../../common/components/buttons/EntityRefreshButton";
import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { EntityStatusChip, Label } from "../../common/components/labels";
import {
  EntityProvider,
  useEntityProvider,
} from "../../common/context/EntityContext";
import { HeroPlusCircleIcon, HeroSquare3Stack3DIcon } from "../../icons";
import { Button, Tooltip } from "../../ui";
import { ENTITY_STATUS } from "../../utils/constants";
import { TemplateContent } from "../components/TemplateContent";
import { TEMPLATE_DETAIL_FIELDS } from "../graphql";

export const TemplatePage = () => {
  const { template_id } = useParams();

  return (
    <EntityProvider
      entity_name="template"
      entity_id={template_id || ""}
      entityFields={TEMPLATE_DETAIL_FIELDS}
    >
      <TemplatePageContent />
    </EntityProvider>
  );
};

const TemplatePageContent = () => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();
  const { entity } = useEntityProvider();

  // The API serializes status with its display casing (e.g. "DISABLED"); the
  // constants are lowercase, so normalize before comparing.
  const isDisabled =
    String(entity?.status ?? "").toLocaleLowerCase() === ENTITY_STATUS.DISABLED;

  const handleUseTemplate = () => {
    if (entity?.id) {
      navigate(`${linkPrefix}resources/create`, {
        state: { template_id: entity.id },
      });
    }
  };

  return (
    <EntityContainer
      titleIcon={<HeroSquare3Stack3DIcon />}
      titleAdornment={
        entity?.abstract ? (
          <>
            <Label tone="info" label="ABSTRACT" />
            <EntityStatusChip status={entity.status} state={entity.state} />
          </>
        ) : undefined
      }
      actions={
        <>
          {!isDisabled && (
            <Tooltip title="Create a new resource from this template">
              <Button
                onClick={handleUseTemplate}
                startIcon={<HeroPlusCircleIcon />}
              >
                Create Resource
              </Button>
            </Tooltip>
          )}
          <EntityRefreshButton />
        </>
      }
    >
      <TemplateContent />
    </EntityContainer>
  );
};

TemplatePage.path = "/templates/:template_id/:tab?";
