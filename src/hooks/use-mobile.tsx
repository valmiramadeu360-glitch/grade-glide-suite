import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Hook customizado para detectar dispositivos móveis.
 * Essencial para o layout responsivo do EduFlow Academy.
 */
export function useIsMobile() {
  // Inicializa já verificando a largura para evitar Layout Shift
  const [isMobile, setIsMobile] = React.useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Suporte para navegadores modernos e antigos (Safari iOS)
    if (mql.addEventListener) {
      mql.addEventListener("change", onChange);
    } else {
      mql.addListener(onChange);
    }
    
    // Sincronização final
    onChange();

    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener("change", onChange);
      } else {
        mql.removeListener(onChange);
      }
    };
  }, []);

  return !!isMobile;
}
