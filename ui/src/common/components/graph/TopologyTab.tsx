import { useState } from "react";

import { Tab, Tabs } from "../../../ui";
import { EntityTreeViewTab } from "../tree/TreeViewTab";

import { EntityGraphViewTab } from "./GraphViewTab";

type TopologyView = "tree" | "graph";

const VIEWS: { value: TopologyView; label: string }[] = [
  { value: "tree", label: "Tree" },
  { value: "graph", label: "Graph" },
];

export interface TopologyTabProps {
  entity_name: string;
  entity_id: string;
}

/** Tree and graph renderings of the same entity hierarchy behind one tab. */
export const TopologyTab = ({ entity_id, entity_name }: TopologyTabProps) => {
  const [view, setView] = useState<TopologyView>("tree");

  return (
    <div className="flex w-full flex-col gap-4">
      <Tabs
        appearance="segmented"
        className="self-end"
        value={view}
        onChange={(_, next: TopologyView) => setView(next)}
        aria-label="Topology view"
      >
        {VIEWS.map(({ value, label }) => (
          <Tab key={value} value={value} label={label} />
        ))}
      </Tabs>
      {view === "tree" ? (
        <EntityTreeViewTab entity_id={entity_id} entity_name={entity_name} />
      ) : (
        <EntityGraphViewTab entity_id={entity_id} entity_name={entity_name} />
      )}
    </div>
  );
};
