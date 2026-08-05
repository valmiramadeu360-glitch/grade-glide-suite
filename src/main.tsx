import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNative } from "./lib/native";

// O "!" garante ao TypeScript que o elemento 'root' realmente existe no HTML
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Falha ao encontrar o elemento root. O index.html está correto?");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// No navegador isso é um no-op; no app nativo ajusta status bar e esconde o splash.
void initNative();

