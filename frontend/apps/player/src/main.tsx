import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { claimDocumentLang } from "./i18n";
import "./index.css";

// Before the first render, not after it: `index.html` can only ship one
// language and this app is served to two. See claimDocumentLang.
claimDocumentLang();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
