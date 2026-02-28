import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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

