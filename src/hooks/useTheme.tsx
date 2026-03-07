import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type ThemeMode = "light" | "dark";

interface ThemeColors {
  label: string;
  hue: number;
  saturation: number;
  lightness: number;
}

const THEME_COLORS: ThemeColors[] = [
  { label: "Azul", hue: 221, saturation: 83, lightness: 53 },
  { label: "Vermelho", hue: 0, saturation: 72, lightness: 51 },
  { label: "Verde", hue: 142, saturation: 71, lightness: 45 },
  { label: "Amarelo", hue: 45, saturation: 93, lightness: 47 },
  { label: "Laranja", hue: 24, saturation: 95, lightness: 53 },
  { label: "Roxo", hue: 263, saturation: 70, lightness: 50 },
  { label: "Rosa", hue: 330, saturation: 81, lightness: 60 },
  { label: "Marrom", hue: 25, saturation: 45, lightness: 35 },
  { label: "Azul Bebê", hue: 199, saturation: 89, lightness: 68 },
  { label: "Rosa Bebê", hue: 340, saturation: 82, lightness: 76 },
  { label: "Cinza", hue: 220, saturation: 9, lightness: 46 },
  { label: "Ciano", hue: 187, saturation: 85, lightness: 43 },
  { label: "Magenta", hue: 300, saturation: 76, lightness: 50 },
  { label: "Dourado", hue: 43, saturation: 74, lightness: 49 },
  { label: "Prateado", hue: 210, saturation: 14, lightness: 65 },
  { label: "Bege", hue: 34, saturation: 57, lightness: 70 },
  { label: "Vinho", hue: 340, saturation: 60, lightness: 30 },
  { label: "Turquesa", hue: 174, saturation: 72, lightness: 40 },
  { label: "Mostarda", hue: 47, saturation: 80, lightness: 44 },
  { label: "Coral", hue: 16, saturation: 100, lightness: 66 },
];

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  primaryColor: ThemeColors;
  setPrimaryColor: (color: ThemeColors) => void;
  availableColors: ThemeColors[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyPrimaryColor(color: ThemeColors, mode: ThemeMode) {
  if (typeof window === "undefined") return;
  
  const root = document.documentElement;
  const { hue, saturation, lightness } = color;

  if (mode === "dark") {
    const safeLightness = Math.min(lightness + 15, 80);
    root.style.setProperty("--primary", `${hue} ${saturation}% ${safeLightness}%`);
    root.style.setProperty("--ring", `${hue} ${saturation}% ${safeLightness}%`);
  } else {
    root.style.setProperty("--primary", `${hue} ${saturation}% ${lightness}%`);
    root.style.setProperty("--ring", `${hue} ${saturation}% ${lightness}%`);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem("eduflow-theme-mode");
    return (saved as ThemeMode) || "light";
  });

  const [primaryColor, setPrimaryColorState] = useState<ThemeColors>(() => {
    if (typeof window === "undefined") return THEME_COLORS[0];
    const saved = localStorage.getItem("eduflow-primary-color");
    if (saved) {
      try { return JSON.parse(saved); } catch { return THEME_COLORS[0]; }
    }
    return THEME_COLORS[0];
  });

  function setMode(m: ThemeMode) {
    setModeState(m);
    localStorage.setItem("eduflow-theme-mode", m);
  }

  function setPrimaryColor(c: ThemeColors) {
    setPrimaryColorState(c);
    localStorage.setItem("eduflow-primary-color", JSON.stringify(c));
  }

  useEffect(() => {
    const root = document.documentElement;
    if (mode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    applyPrimaryColor(primaryColor, mode);
  }, [mode, primaryColor]);

  return (
    <ThemeContext.Provider value={{ mode, setMode, primaryColor, setPrimaryColor, availableColors: THEME_COLORS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de um ThemeProvider");
  return ctx;
}
