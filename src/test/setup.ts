import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Limpa o DOM após cada teste para evitar que um teste suje o outro
afterEach(() => {
  cleanup();
});

// Simulação (Mock) do matchMedia para o useIsMobile funcionar nos testes
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Funções legadas
    removeListener: vi.fn(), // Funções legadas
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Impede que erros de console poluam a saída dos seus testes de BI
console.error = vi.fn();
console.warn = vi.fn();
