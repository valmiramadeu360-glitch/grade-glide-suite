import * as React from "react";

// O breakpoint de 768px é o padrão do Tailwind (md)
const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < MOBILE_BREAKPOINT;
    }
    return false;
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Suporte híbrido: addEventListener (moderno) e addListener (Safari antigo)
    if (mql.addEventListener) {
      mql.addEventListener("change", onChange);
    } else {
      (mql as any).addListener(onChange);
    }
    
    // Sincronização imediata
    setIsMobile(mql.matches);

    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener("change", onChange);
      } else {
        (mql as any).removeListener(onChange);
      }
    };
  }, []);

  return !!isMobile;
}
