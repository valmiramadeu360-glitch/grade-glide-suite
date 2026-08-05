/**
 * Ponte nativa (Capacitor) do EduFlow.
 *
 * Regra de ouro: no navegador/PWA nada muda — cada helper cai no
 * comportamento web original quando não estamos rodando dentro do app nativo.
 */
import { Capacitor } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();
export const nativePlatform = () => Capacitor.getPlatform() as "ios" | "android" | "web";

/** Inicializa status bar e splash apenas no app nativo. */
export async function initNative() {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    if (nativePlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#020617" });
    }
  } catch (err) {
    console.warn("Native: status bar indisponível", err);
  }
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch (err) {
    console.warn("Native: splash indisponível", err);
  }
}

/**
 * Geolocalização com permissão nativa (usada no RU).
 * Retorna o mesmo formato do browser para não quebrar quem já consome.
 */
export async function getNativePosition(): Promise<{ coords: { latitude: number; longitude: number; accuracy: number } }> {
  const { Geolocation } = await import("@capacitor/geolocation");
  let status = await Geolocation.checkPermissions();
  if (status.location !== "granted") {
    status = await Geolocation.requestPermissions({ permissions: ["location"] });
  }
  if (status.location !== "granted") {
    throw new Error("Permissão de localização negada. Ative para colaborar com a fila.");
  }
  const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
  return { coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy } };
}

/**
 * Captura de foto pela câmera nativa (cardápio do RU, atestado, avatar).
 * Retorna um File pronto para upload no Storage, ou null se não for nativo
 * (nesse caso o chamador segue usando o <input type="file"> normal).
 */
export async function takeNativePhoto(fileName = "captura.jpg"): Promise<File | null> {
  if (!isNative()) return null;
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  const perms = await Camera.checkPermissions();
  if (perms.camera !== "granted") {
    const asked = await Camera.requestPermissions({ permissions: ["camera", "photos"] });
    if (asked.camera !== "granted") throw new Error("Permissão de câmera negada.");
  }
  const photo = await Camera.getPhoto({
    quality: 82,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: CameraSource.Prompt,
  });
  if (!photo.webPath) throw new Error("Não foi possível ler a foto capturada.");
  const blob = await (await fetch(photo.webPath)).blob();
  return new File([blob], fileName, { type: blob.type || "image/jpeg" });
}
