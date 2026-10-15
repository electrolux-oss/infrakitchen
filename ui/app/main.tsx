import * as React from "react";

import * as ReactDOM from "react-dom/client";

import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/geist-sans/600.css";
import "@fontsource/geist-sans/700.css";
import "@fontsource/geist-mono/400.css";
// Tailwind tokens and utilities; imported directly because the library
// entry's side-effect CSS import is tree-shaken under the source alias.
import "../frontend-lib/src/styles.css";

import { AppWrapper } from "./App.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>,
);
