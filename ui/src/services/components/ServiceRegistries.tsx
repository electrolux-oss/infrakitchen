import { useState } from "react";

import { EntityReference } from "../../common/components/fields/CommonField";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notifyError } from "../../common/hooks/useNotification";
import { CODE_FONT_FAMILY } from "../../common/theme";
import { HeroPlusCircleIcon, HeroTrashIcon } from "../../icons";
import { IkEntity } from "../../types";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
} from "../../ui";
import {
  ADD_SERVICE_REGISTRY_MUTATION,
  GqlService,
  GqlServiceRegistry,
  REMOVE_SERVICE_REGISTRY_MUTATION,
} from "../graphql";

import { IMAGE_REPOSITORY_RE } from "./builds";

interface ServiceRegistriesProps {
  service: GqlService;
  canEdit: boolean;
}

export const ServiceRegistries = ({
  service,
  canEdit,
}: ServiceRegistriesProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const registries = service.registries ?? [];

  const remove = async (registry: GqlServiceRegistry): Promise<void> => {
    setBusyId(registry.id);
    try {
      await ikApi.graphqlRequest(REMOVE_SERVICE_REGISTRY_MUTATION, {
        serviceId: service.id,
        id: registry.id,
      });
      refreshEntity?.();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="col-span-full min-w-0">
      <div className="m-0 mb-0.5 text-(length:--text-body2) font-medium text-fg-muted">
        Image Registries
      </div>
      {registries.length === 0 && (
        <p className="m-0 text-body2 text-fg-muted">Not set</p>
      )}
      {registries.length > 0 && (
        <ul className="m-0 list-none divide-y divide-divider overflow-hidden rounded-lg border border-divider p-0">
          {registries.map((registry) => (
            <li
              key={registry.id}
              className="group/item flex min-w-0 items-center gap-2 px-2.5 py-2"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  {registry.registryIntegration && (
                    <div className="min-w-0 truncate">
                      <EntityReference
                        id={registry.registryIntegration.id}
                        entityName="integration"
                        name={registry.registryIntegration.name}
                        provider={
                          registry.registryIntegration.integrationProvider
                        }
                      />
                    </div>
                  )}
                </div>
                <span
                  className="truncate text-body2 text-fg-muted"
                  style={{ fontFamily: CODE_FONT_FAMILY }}
                  title={registry.imageRepository}
                >
                  {registry.imageRepository}
                </span>
              </div>
              {canEdit && (
                <IconButton
                  title="Remove registry"
                  aria-label={`Remove ${registry.imageRepository}`}
                  size="small"
                  className="opacity-0 transition group-hover/item:opacity-100 focus-visible:opacity-100"
                  disabled={busyId === registry.id}
                  onClick={() => void remove(registry)}
                >
                  <HeroTrashIcon fontSize="small" />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <Button
          variant="text"
          size="small"
          startIcon={<HeroPlusCircleIcon fontSize="small" />}
          onClick={() => setAdding(true)}
        >
          Add registry
        </Button>
      )}
      {adding && (
        <AddRegistryDialog
          service={service}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            refreshEntity?.();
          }}
        />
      )}
    </div>
  );
};

interface AddRegistryDialogProps {
  service: GqlService;
  onClose: () => void;
  onAdded: () => void;
}

const AddRegistryDialog = ({
  service,
  onClose,
  onAdded,
}: AddRegistryDialogProps) => {
  const { ikApi } = useConfig();
  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );
  const existing = service.registries ?? [];
  const [registryId, setRegistryId] = useState<string | null>(null);
  const [repository, setRepository] = useState(
    existing[0]?.imageRepository ?? service.name.toLowerCase(),
  );
  const [saving, setSaving] = useState(false);

  const trimmed = repository.trim();
  const repositoryInvalid = !IMAGE_REPOSITORY_RE.test(trimmed);
  const duplicate = existing.some(
    (registry) =>
      registry.registryIntegration?.id === registryId &&
      registry.imageRepository === trimmed,
  );

  const add = async () => {
    if (!registryId) return;
    setSaving(true);
    try {
      await ikApi.graphqlRequest(ADD_SERVICE_REGISTRY_MUTATION, {
        serviceId: service.id,
        registryIntegrationId: registryId,
        imageRepository: trimmed,
      });
      onAdded();
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add image registry</DialogTitle>
      <DialogContent>
        <ReferenceInput
          ikApi={ikApi}
          buffer={buffer}
          setBuffer={setBuffer}
          entity_name="integrations"
          filter={{ integration_type: "container_registry" }}
          showFields={["integrationProvider", "name"]}
          access="write"
          value={registryId}
          onChange={setRegistryId}
          ariaLabel="Image registry"
          placeholder="Select container registry…"
          helpertext="Each build is pushed to every registry of the service"
        />
        <TextField
          label="Image repository"
          value={repository}
          onChange={(e) => setRepository(e.target.value)}
          error={trimmed !== "" && (repositoryInvalid || duplicate)}
          helperText={
            duplicate
              ? "The service already has this registry and repository"
              : "Repository path in the registry, e.g. team/api. It must already exist for registries like ECR."
          }
          fullWidth
          margin="normal"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          loading={saving}
          disabled={!registryId || repositoryInvalid || duplicate}
          onClick={() => void add()}
        >
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
};
