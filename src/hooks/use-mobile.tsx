import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  // 1. Estado inicial inteligente: já verifica a tela logo na primeira renderização
  // e inclui a trava de segurança (typeof window) caso rode fora do navegador.
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches;
    }
    return false;
  });

  React.useEffect(() => {
    // Trava de segurança adicional
    if (typeof window === "undefined") return;

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    
    // Função otimizada: usa o evento do navegador diretamente
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };

    // Adiciona o ouvinte de evento (usando o padrão moderno do React/Navegadores)
    mql.addEventListener("change", onChange);
    
    // Checagem de segurança pós-montagem
    setIsMobile(mql.matches);

    // Limpeza da memória quando o componente for desmontado
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
