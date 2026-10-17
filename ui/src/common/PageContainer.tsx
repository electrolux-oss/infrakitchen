"use client";
import * as React from "react";

import { useDocumentTitle } from "./hooks/useDocumentTitle";

export interface PageContainerProps {
  children?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Browser tab title; defaults to `title` when it is a string */
  documentTitle?: string;
  /** Page-level notice (e.g. an alert) rendered above the page header */
  banner?: React.ReactNode;
  /** Actions/buttons to render at the right side of the page header */
  actions?: React.ReactNode;
  /** Actions/buttons to render at the bottom of the page, centered */
  bottomActions?: React.ReactNode;
}

export default function PageContainer(props: PageContainerProps) {
  const {
    children,
    title,
    description,
    documentTitle,
    banner = null,
    actions = null,
    bottomActions = null,
  } = props;

  useDocumentTitle(
    documentTitle ?? (typeof title === "string" ? title : undefined),
  );

  return (
    <div className="box-border flex w-full flex-1 flex-col px-4 sm:px-6">
      <div className="my-4 flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex flex-col">
          {banner}
          <div className="mt-4 flex flex-row flex-wrap justify-between gap-4">
            <div className="flex min-w-0 flex-col wrap-anywhere">
              {title ? (
                <h1 className="m-0 text-h5 font-semibold">{title}</h1>
              ) : null}
              {description ? (
                <p className="m-0 mt-2 text-body2 text-fg-muted">
                  {description}
                </p>
              ) : null}
            </div>
            <div className="ml-auto flex flex-row flex-wrap gap-2">
              {actions}
            </div>
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-col items-center overflow-y-auto">
          {children}
        </div>
        {bottomActions ? (
          <div className="flex w-full items-center justify-center gap-4">
            {bottomActions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
