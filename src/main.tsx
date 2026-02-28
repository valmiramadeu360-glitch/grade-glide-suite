import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./globals.css"; // Certificando a importação do DNA visual

// O "!" garante ao TypeScript que o elemento 'root' realmente existe no HTML
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Falha crítica: Elemento #root não encontrado no DOM.");
}

// Log de Inicialização Acadêmica
console.log(
  "%c EduFlow Academy %c v1.0.0 ",
  "color: white; background: #3b82f6; font-weight: bold; border-radius: 4px 0 0 4px; padding: 2px 6px;",
  "color: #3b82f6; background: #1e293b; font-weight: bold; border-radius: 0 4px 4px 0; padding: 2px 6px;"
);

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
