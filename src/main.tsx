import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRoot } from "@/App";
import { applyTheme, readTheme } from "@/lib/theme";
import "@/styles.css";

applyTheme(readTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
