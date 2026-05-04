import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { importIfNeeded } from "./services/ingredientImporter";
import "./theme.css";

// First-launch ingredient seed (no-op if already populated).
void importIfNeeded().catch((err) => {
  console.warn("Ingredient import failed:", err);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
