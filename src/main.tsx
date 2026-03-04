import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// O "!" garante ao TypeScript que o elemento 'root' realmente existe no HTML
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Falha ao encontrar o elemento root. O index.html está correto?");
}

// Inicialização do App EduFlow
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// NOTA PARA O FUTURO (PWA): 
// É neste arquivo que registraremos o Service Worker para que o 
// EduFlow funcione offline e carregue instantaneamente no celular.

