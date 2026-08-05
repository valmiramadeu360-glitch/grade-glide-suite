import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.d06f46ccc4934603ac9010326f248b25",
  appName: "eduflow-academy-hub",
  webDir: "dist",
  // Hot-reload direto do sandbox Lovable durante o desenvolvimento.
  // Remova o bloco "server" para gerar uma build de produção offline (usa webDir).
  server: {
    url: "https://d06f46cc-c493-4603-ac90-10326f248b25.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#020617",
    },
    Geolocation: {},
    Camera: {},
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
