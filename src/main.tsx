import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { AlertProvider } from "./components/AlertProvider";
import { importIfNeeded, recategoriseSuspectAisles } from "./services/ingredientImporter";
import "./theme.css";

// First-launch ingredient seed (no-op if already populated), then a one-time
// retroactive aisle fix-up so existing devices benefit from the regex priorities
// added after the original buggy converter ran.
void (async () => {
  try {
    await importIfNeeded();
    await recategoriseSuspectAisles();
  } catch (err) {
    console.warn("Ingredient bootstrap failed:", err);
  }
})();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <AlertProvider>
        <App />
      </AlertProvider>
    </HashRouter>
  </StrictMode>,
);
