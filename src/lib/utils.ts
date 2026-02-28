import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utilitário para mesclar classes Tailwind de forma inteligente.
 * Resolve conflitos como 'p-2 p-4' para 'p-4'.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
