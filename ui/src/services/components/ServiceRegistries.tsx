import { ReactNode, useState } from "react";

import { EntityReference } from "../../common/components/fields/CommonField";
import { FieldInfo } from "../../common/components/fields/FieldInfo";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notifyError } from "../../common/hooks/useNotification";
import { CODE_FONT_FAMILY } from "../../common/theme";
import { ApiClientError } from "../../errors";
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
  Tooltip,
} from "../../ui";
import {
  ADD_SERVICE_BASE_IMAGE_REGISTRY_MUTATION,
  ADD_SERVICE_REGISTRY_MUTATION,
  GqlService,
  GqlServiceRegistry,
  REMOVE_SERVICE_BASE_IMAGE_REGISTRY_MUTATION,
  REMOVE_SERVICE_REGISTRY_MUTATION,
} from "../graphql";

import { IMAGE_REPOSITORY_RE } from "./builds";

const READ_ONLY_REASON = "Only service and project owners can edit";

const REMOVE_BUTTON_CLASS =
  "opacity-0 transition group-hover/item:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100";

interface ServiceRegistriesProps {
  service: GqlService;
  canEdit: boolean;
}

const SectionLabel = ({ name, info }: { name: string; info: string }) => (
  <div className="m-0 mb-0.5 flex items-center gap-1 text-(length:--text-body2) font-medium text-fg-muted">
    <span>{name}</span>
    <FieldInfo text={info} />
  </div>
);

const AddButton = ({
  canEdit,
  onClick,
  children,
}: {
  canEdit: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <Tooltip title={canEdit ? null : READ_ONLY_REASON}>
    <span className="-ml-2 inline-flex">
      <Button
        variant="text"
        size="small"
        startIcon={<HeroPlusCircleIcon fontSize="small" />}
        disabled={!canEdit}
        onClick={onClick}
      >
        {children}
      </Button>
    </span>
  </Tooltip>
);

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
      <SectionLabel
        name="Container Registries"
        info="Every build is pushed to all registries listed here"
      />
      {registries.length === 0 && (
        <div className="mb-1">
          <PlaceholderText />
        </div>
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
                  className={REMOVE_BUTTON_CLASS}
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
      <AddButton canEdit={canEdit} onClick={() => setAdding(true)}>
        Add registry
      </AddButton>
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

export const BaseImageRegistries = ({
  service,
  canEdit,
}: ServiceRegistriesProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const integrations = service.baseImageRegistries ?? [];

  const remove = async (integrationId: string): Promise<void> => {
    setBusyId(integrationId);
    try {
      await ikApi.graphqlRequest(REMOVE_SERVICE_BASE_IMAGE_REGISTRY_MUTATION, {
        serviceId: service.id,
        integrationId,
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
      <SectionLabel
        name="Base Image Registries"
        info="Only needed if the Dockerfile uses private base images. Builds log in to these registries to pull FROM images, never to push."
      />
      {integrations.length === 0 && (
        <div className="mb-1">
          <PlaceholderText />
        </div>
      )}
      {integrations.length > 0 && (
        <ul className="m-0 list-none divide-y divide-divider overflow-hidden rounded-lg border border-divider p-0">
          {integrations.map((integration) => (
            <li
              key={integration.id}
              className="group/item flex min-w-0 items-center gap-2 px-2.5 py-2"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="min-w-0 truncate">
                  <EntityReference
                    id={integration.id}
                    entityName="integration"
                    name={integration.name}
                    provider={integration.integrationProvider}
                  />
                </div>
                <span className="text-body2 text-fg-muted">Pull only</span>
              </div>
              {canEdit && (
                <IconButton
                  title="Remove base image registry"
                  aria-label={`Remove ${integration.name}`}
                  size="small"
                  className={REMOVE_BUTTON_CLASS}
                  disabled={busyId === integration.id}
                  onClick={() => void remove(integration.id)}
                >
                  <HeroTrashIcon fontSize="small" />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
      <AddButton canEdit={canEdit} onClick={() => setAdding(true)}>
        Add base image registry
      </AddButton>
      {adding && (
        <AddBaseImageRegistryDialog
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

const AddBaseImageRegistryDialog = ({
  service,
  onClose,
  onAdded,
}: AddRegistryDialogProps) => {
  const { ikApi } = useConfig();
  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const unusable = new Set([
    ...(service.registries ?? []).flatMap((registry) =>
      registry.registryIntegration ? [registry.registryIntegration.id] : [],
    ),
    ...(service.baseImageRegistries ?? []).map((integration) => integration.id),
  ]);
  const loaded = buffer.integrations as IkEntity[] | undefined;
  const noneLeft =
    !!loaded && loaded.every((integration) => unusable.has(integration.id));

  const add = async () => {
    if (!integrationId) return;
    setSaving(true);
    try {
      await ikApi.graphqlRequest(ADD_SERVICE_BASE_IMAGE_REGISTRY_MUTATION, {
        serviceId: service.id,
        integrationId,
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
      <DialogTitle>Add base image registry</DialogTitle>
      <DialogContent>
        <p className="m-0 mb-4 text-body2 text-fg-muted">
          Only needed if the Dockerfile pulls private base images. The
          Dockerfile can read this login, so use read-only credentials.
          Integrations the service pushes with cannot be used here.
        </p>
        <ReferenceInput
          ikApi={ikApi}
          buffer={buffer}
          setBuffer={setBuffer}
          entity_name="integrations"
          filter={{ integration_type: "container_registry" }}
          showFields={["integrationProvider", "name"]}
          access="write"
          value={integrationId}
          onChange={setIntegrationId}
          optionFilter={(option: IkEntity) => !unusable.has(option.id)}
          label="Registry"
          placeholder="Select container registry…"
          disabled={noneLeft}
          helpertext={
            noneLeft
              ? "No other container registry integration. Create one with read-only credentials for this registry."
              : undefined
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          loading={saving}
          disabled={!integrationId}
          onClick={() => void add()}
        >
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
};

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
  const pullIds = new Set(
    (service.baseImageRegistries ?? []).map((integration) => integration.id),
  );
  const [registryId, setRegistryId] = useState<string | null>(null);
  const [repository, setRepository] = useState(
    existing[0]?.imageRepository ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const trimmed = repository.trim();
  const empty = trimmed === "";
  const repositoryInvalid = !IMAGE_REPOSITORY_RE.test(trimmed);
  const duplicate = existing.some(
    (registry) =>
      registry.registryIntegration?.id === registryId &&
      registry.imageRepository === trimmed,
  );

  const add = async () => {
    if (!registryId) return;
    setSaving(true);
    setAddError(null);
    try {
      await ikApi.graphqlRequest(ADD_SERVICE_REGISTRY_MUTATION, {
        serviceId: service.id,
        registryIntegrationId: registryId,
        imageRepository: trimmed,
      });
      onAdded();
    } catch (e) {
      if (e instanceof ApiClientError && e.status < 500) {
        setAddError(e.message);
      } else {
        notifyError(e);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add container registry</DialogTitle>
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
          onChange={(id: string | null) => {
            setRegistryId(id);
            setAddError(null);
          }}
          optionFilter={(option: IkEntity) => !pullIds.has(option.id)}
          label="Registry"
          placeholder="Select container registry…"
          required
          helpertext="Each build is pushed to every registry of the service. Base image registries are not listed."
        />
        <TextField
          label="Image repository"
          value={repository}
          onChange={(e) => {
            setRepository(e.target.value);
            setAddError(null);
          }}
          required
          error={!!addError || (!empty && (repositoryInvalid || duplicate))}
          helperText={
            addError
              ? addError
              : duplicate
                ? "The service already has this registry and repository"
                : repositoryInvalid && !empty
                  ? "Lowercase letters, digits, '.', '_', '-' and '/' only, e.g. team/api"
                  : "Full repository path in the registry, e.g. team/api. For ECR, create the repository first and use the path after the registry host in its URL."
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
