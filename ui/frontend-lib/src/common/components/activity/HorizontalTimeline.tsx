import { ReactNode } from "react";

import { cn } from "../../../utils/cn";

export interface HorizontalTimelineItem {
  id: string;
}

export interface HorizontalTimelineProps<T extends HorizontalTimelineItem> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
}

export const HorizontalTimeline = <T extends HorizontalTimelineItem>({
  items,
  renderItem,
}: HorizontalTimelineProps<T>) => {
  return (
    <div className="ml-4 flex flex-wrap">
      {items.map((item, index) => (
        <div className="flex min-w-40 flex-col items-center pb-2" key={item.id}>
          <div className="flex h-3 w-full flex-row items-center">
            <div
              className={cn(
                index > 0 ? "bg-fg-disabled" : "bg-transparent",
                "h-0.5 flex-1",
              )}
            />
            <div className="h-3 w-3 shrink-0 rounded-full bg-primary" />
            <div
              className={cn(
                index < items.length - 1 ? "bg-fg-disabled" : "bg-transparent",
                "h-0.5 flex-1",
              )}
            />
            {index < items.length - 1 && (
              <div className="h-0 w-0 shrink-0 border-y-5 border-l-6 border-y-transparent border-l-fg-disabled" />
            )}
          </div>
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
};
