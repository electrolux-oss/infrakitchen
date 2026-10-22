import {
  DragEvent,
  KeyboardEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  HeroChevronLeftIcon,
  HeroChevronRightIcon,
  HeroCircleStackIcon,
  HeroCodeBracketIcon,
  HeroHashtagIcon,
  HeroLanguageIcon,
  HeroMagnifyingGlassIcon,
  HeroPlusCircleIcon,
  HeroSquare3Stack3DIcon,
} from "../../../../icons";
import {
  GqlTemplateShort,
  TEMPLATE_SHORT_FIELDS,
} from "../../../../templates/graphql";
import {
  Divider,
  InputAdornment,
  Label,
  Skeleton,
  TextField,
  Tooltip,
} from "../../../../ui";
import { useConfig, useLocalStorage } from "../../../context";

import { GenericTemplate } from "./types";
import {
  ConstantType,
  WiringCanvasExternalTemplate,
} from "./WiringCanvas.types";

// Drag-and-drop payload types, read by the canvas on drop
export const DRAG_TYPE = "application/ik-template";
export const DRAG_TYPE_EXTERNAL = "application/ik-external-template";
export const DRAG_TYPE_CONSTANT = "application/ik-constant";

/** Same row look as the app's navigation sidebar. */
const ROW_CLASS =
  "group/item relative flex w-full cursor-grab items-center gap-2 rounded-surface px-2 py-1 text-body2 text-fg/70 outline-none select-none hover:bg-grey-900/5 hover:text-fg focus-visible:bg-grey-900/5 active:cursor-grabbing dark:hover:bg-grey-100/8 dark:focus-visible:bg-grey-100/8 [&_svg]:size-4.5 [&_svg]:shrink-0";

const CONSTANT_ITEMS = [
  { type: "string", label: "String", Icon: HeroLanguageIcon },
  { type: "number", label: "Number", Icon: HeroHashtagIcon },
] as const;

type LibraryTemplate = GqlTemplateShort & {
  configuration: { naming_convention?: string | null } | null;
};

const toGenericTemplate = (t: LibraryTemplate): GenericTemplate => ({
  id: t.id,
  name: t.name,
  abstract: t.abstract,
  entityName: t.entityName,
  cloudResourceTypes: t.cloudResourceTypes,
  namingConvention: t.configuration?.naming_convention ?? null,
});

/** Local storage key for the library's collapsed state. */
const COLLAPSED_KEY = "wiringLibraryCollapsed";

/** Icon button that hides or shows the library panel. */
function PanelToggle({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip title={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent p-0 text-fg-muted transition-colors hover:bg-hover hover:text-fg"
      >
        {children}
      </button>
    </Tooltip>
  );
}

interface WiringLibraryProps {
  selectedIds: Set<string>;
  externalTemplateIds: Set<string>;
  missingParentTemplates: WiringCanvasExternalTemplate[];
  onTemplateAdd: (template: GenericTemplate) => void;
  onExternalTemplateAdd: (template: WiringCanvasExternalTemplate) => void;
  onConstantAdd: (type: ConstantType) => void;
}

/** Panel of things that can be dragged onto the wiring canvas. */
export function WiringLibrary({
  selectedIds,
  externalTemplateIds,
  missingParentTemplates,
  onTemplateAdd,
  onExternalTemplateAdd,
  onConstantAdd,
}: WiringLibraryProps) {
  const { ikApi } = useConfig();
  const [templates, setTemplates] = useState<LibraryTemplate[] | null>(null);
  const [search, setSearch] = useState("");
  const { get: getStored, setKey: setStored } = useLocalStorage();
  const collapsed = Boolean(getStored(COLLAPSED_KEY));
  const setCollapsed = (value: boolean) => setStored(COLLAPSED_KEY, value);

  useEffect(() => {
    ikApi
      .graphqlRequest<{ templates: LibraryTemplate[] }>(
        `query Templates($sort: [String!], $range: [Int!]) {
          templates(sort: $sort, range: $range) {
            ${TEMPLATE_SHORT_FIELDS}
            configuration
          }
        }`,
        { sort: ["name", "ASC"], range: [0, 500] },
      )
      .then((res) => setTemplates(res.templates || []))
      .catch(() => setTemplates([]));
  }, [ikApi]);

  const query = search.trim().toLowerCase();
  const matches = (name: string) => name.toLowerCase().includes(query);

  const availableTemplates = useMemo(
    () =>
      (templates ?? []).filter(
        (t) => !selectedIds.has(t.id) && !externalTemplateIds.has(t.id),
      ),
    [templates, selectedIds, externalTemplateIds],
  );
  const shownTemplates = availableTemplates.filter((t) => matches(t.name));
  const parents = missingParentTemplates.filter(
    (t) => !externalTemplateIds.has(t.id),
  );
  const shownParents = parents.filter((t) => matches(t.name));

  const dragTemplate = (e: DragEvent, t: LibraryTemplate) => {
    // The whole template, so a drop adds the same thing as a click
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(toGenericTemplate(t)));
    e.dataTransfer.effectAllowed = "copy";
  };
  const dragParent = (e: DragEvent, t: WiringCanvasExternalTemplate) => {
    e.dataTransfer.setData(
      DRAG_TYPE_EXTERNAL,
      JSON.stringify({ id: t.id, name: t.name, abstract: t.abstract }),
    );
    e.dataTransfer.effectAllowed = "copy";
  };
  const dragConstant = (e: DragEvent, type: ConstantType) => {
    e.dataTransfer.setData(DRAG_TYPE_CONSTANT, type);
    e.dataTransfer.effectAllowed = "copy";
  };

  if (collapsed) {
    return (
      <aside
        aria-label="Wiring library"
        className="flex w-10 shrink-0 flex-col items-center border-r border-divider bg-canvas py-3"
      >
        <PanelToggle label="Show library" onClick={() => setCollapsed(false)}>
          <HeroChevronRightIcon fontSize="small" />
        </PanelToggle>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Wiring library"
      className="flex w-64 shrink-0 flex-col border-r border-divider bg-canvas"
    >
      <div className="flex items-center gap-1 p-3">
        <TextField
          placeholder="Search templates"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          aria-label="Search templates"
          startAdornment={
            <InputAdornment position="start">
              <HeroMagnifyingGlassIcon
                className="text-fg-disabled"
                fontSize="small"
              />
            </InputAdornment>
          }
        />
        <PanelToggle label="Hide library" onClick={() => setCollapsed(true)}>
          <HeroChevronLeftIcon fontSize="small" />
        </PanelToggle>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {parents.length > 0 && (
          <>
            <Group
              title="Parent resources"
              count={parents.length}
              hint="Existing resources whose outputs your templates need."
            >
              {shownParents.map((t) => (
                <Item
                  key={t.id}
                  name={t.name}
                  abstract={t.abstract}
                  icon={<HeroCircleStackIcon className="text-warning" />}
                  onDragStart={(e) => dragParent(e, t)}
                  onAdd={() => onExternalTemplateAdd(t)}
                  addLabel="Add as parent resource"
                />
              ))}
              {shownParents.length === 0 && <Empty>No matches</Empty>}
            </Group>
            <Divider className="my-2" />
          </>
        )}

        <Group
          title="Templates"
          count={templates === null ? undefined : availableTemplates.length}
        >
          {templates === null &&
            Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} variant="rounded" className="my-1 h-7" />
            ))}
          {shownTemplates.map((t) => (
            <Item
              key={t.id}
              name={t.name}
              abstract={t.abstract}
              icon={<HeroSquare3Stack3DIcon />}
              onDragStart={(e) => dragTemplate(e, t)}
              onAdd={() => onTemplateAdd(toGenericTemplate(t))}
              addLabel="Add to canvas"
            />
          ))}
          {templates !== null && shownTemplates.length === 0 && (
            <Empty>
              {query ? "No matches" : "All templates are on the canvas"}
            </Empty>
          )}
        </Group>
      </div>

      <Divider />
      <div className="px-2 pt-2 pb-3">
        <Group
          title="Constants"
          icon={<HeroCodeBracketIcon className="size-4 text-secondary" />}
          hint="Fixed values wired to inputs. Click or drag to the canvas."
        >
          {CONSTANT_ITEMS.map(({ type, label, Icon }) => (
            <Item
              key={type}
              name={label}
              icon={<Icon className="text-secondary" />}
              onDragStart={(e) => dragConstant(e, type)}
              onAdd={() => onConstantAdd(type)}
              addLabel={`Add ${label.toLowerCase()} constant`}
              clickToAdd
            />
          ))}
        </Group>
      </div>
    </aside>
  );
}

/** Section heading in the style of the entity sidebar sections. */
function Group({
  title,
  icon,
  count,
  hint,
  children,
}: {
  title: string;
  icon?: ReactNode;
  count?: number;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="m-0 flex min-h-8 items-center gap-2 px-2 text-[0.875rem] font-semibold text-fg-muted">
        {icon}
        {title}
        {count !== undefined && <Label size="small" label={count} />}
      </h3>
      {hint && (
        <p className="m-0 px-2 pb-1.5 text-caption text-fg-muted">{hint}</p>
      )}
      <ul className="m-0 list-none p-0">{children}</ul>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <li className="px-2 py-1.5 text-caption text-fg-disabled">{children}</li>
  );
}

function Item({
  name,
  abstract,
  icon,
  onDragStart,
  onAdd,
  addLabel,
  clickToAdd,
}: {
  name: string;
  abstract?: boolean;
  icon: ReactNode;
  onDragStart: (e: DragEvent) => void;
  onAdd: () => void;
  addLabel: string;
  /** Add on a single click rather than a double click. */
  clickToAdd?: boolean;
}) {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onAdd();
    }
  };
  return (
    <li>
      {/* A div, not a <button>: Firefox does not start drags from buttons */}
      <div
        role="button"
        tabIndex={0}
        draggable
        aria-label={clickToAdd ? addLabel : `${name}, drag to the canvas`}
        onDragStart={onDragStart}
        onClick={clickToAdd ? onAdd : undefined}
        onDoubleClick={clickToAdd ? undefined : onAdd}
        onKeyDown={onKeyDown}
        className={ROW_CLASS}
      >
        {icon}
        <Tooltip title={name} placement="right" enterDelay={600}>
          <span className="min-w-0 flex-1 truncate">{name}</span>
        </Tooltip>
        {abstract && <Label tone="info" size="small" label="ABSTRACT" />}
        {!clickToAdd && (
          <Tooltip title={addLabel}>
            <button
              type="button"
              tabIndex={-1}
              aria-label={`${addLabel}: ${name}`}
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
              className="grid shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-fg-disabled opacity-0 transition group-hover/item:opacity-100 group-focus-visible/item:opacity-100 hover:text-primary"
            >
              <HeroPlusCircleIcon />
            </button>
          </Tooltip>
        )}
      </div>
    </li>
  );
}
