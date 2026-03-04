import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utilitário de mesclagem de classes do Tailwind CSS.
 * Garante que estilos condicionais e estados (hover, active) 
 * não entrem em conflito no aplicativo.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
