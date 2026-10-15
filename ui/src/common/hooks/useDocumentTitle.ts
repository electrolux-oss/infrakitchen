import { useEffect } from "react";

const APP_TITLE = "InfraKitchen";

export const useDocumentTitle = (title?: string) => {
  useEffect(() => {
    if (!title) return;
    const previousTitle = document.title;
    document.title = `${title} | ${APP_TITLE}`;
    return () => {
      document.title = previousTitle;
    };
  }, [title]);
};
