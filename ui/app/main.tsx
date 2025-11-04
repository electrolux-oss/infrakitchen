import * as React from "react";

import * as ReactDOM from "react-dom/client";

import { AppWrapper } from "./App.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>,
);
