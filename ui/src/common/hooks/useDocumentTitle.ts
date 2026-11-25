import { useContext, useEffect } from "react";

import { ConfigContext } from "../context/ConfigContext";

const APP_TITLE = "InfraKitchen";

export const useDocumentTitle = (title?: string) => {
  const instanceName = useContext(ConfigContext)?.instanceName;

  useEffect(() => {
    if (!title) return;
    const previousTitle = document.title;
    document.title = `${title} | ${APP_TITLE}${instanceName ? ` (${instanceName})` : ""}`;
    return () => {
      document.title = previousTitle;
    };
  }, [title, instanceName]);
};
