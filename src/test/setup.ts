import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// 1. Limpeza automática do DOM para evitar "sujeira" entre os testes
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// 2. Simulação (Mock) robusta do matchMedia
// Essencial para validar o hook useIsMobile e as adaptações para celular
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: query.includes("(max-width: 767px)"), // Lógica dinâmica baseada no seu breakpoint
    media: query,
    onchange: null,
    addListener: vi.fn(), 
    removeListener: vi.fn(), 
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// 3. Organização da saída de testes
// Impede que warnings conhecidos de bibliotecas externas poluam seu terminal de BI
console.error = vi.fn();
console.warn = vi.fn();

// 4. Mock do IntersectionObserver (comum em componentes de scroll e animações)
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
