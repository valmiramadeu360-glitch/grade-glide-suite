import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// 1. Limpeza rigorosa entre cada teste
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  // Limpa o cache de estilos injetados durante os testes de tema
  document.documentElement.style.cssText = "";
  document.documentElement.className = "";
});

// 2. Mock Robusto do matchMedia (Breakpoint: 768px)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: query.includes("(max-width: 767px)"),
    media: query,
    onchange: null,
    addListener: vi.fn(), 
    removeListener: vi.fn(), 
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// 3. Mock do ResizeObserver (Vital para gráficos e barras de progresso)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// 4. Mock do IntersectionObserver (Para animações de fade-in e scroll)
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// 5. Mock de funções de scroll (Evita erros em navegação mobile)
window.scrollTo = vi.fn();
Element.prototype.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

// 6. Silenciamento Seletivo de Console
// Permite logs informativos mas esconde avisos de bibliotecas de terceiros (Radix/Shadcn)
console.error = vi.fn();
console.warn = vi.fn();

// 7. Mock do LocalStorage para testes de Tema e Semestre
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    clear: () => { store = {}; },
    removeItem: (key: string) => { delete store[key]; },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

