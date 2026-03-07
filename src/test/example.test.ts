import { describe, it, expect } from "vitest";
import { differenceInDays, startOfDay, parseISO } from "date-fns";

/**
 * Lógica oficial de progresso do EduFlow Academy.
 * @param start Data de início do período letivo
 * @param end Data de término (férias)
 * @param now Data atual de consulta
 */
function calculateSemesterProgress(start: Date, end: Date, now: Date) {
  // Padronizamos para o início do dia para evitar bugs de fuso horário/horas
  const s = startOfDay(start);
  const e = startOfDay(end);
  const n = startOfDay(now);

  const totalDays = differenceInDays(e, s);
  
  // Proteção contra datas invertidas ou iguais configuradas pelo usuário
  if (totalDays <= 0) return 0;
  
  const elapsedDays = differenceInDays(n, s);
  const percentage = Math.round((elapsedDays / totalDays) * 100);
  
  // Garante que o resultado esteja SEMPRE entre 0 e 100
  return Math.min(100, Math.max(0, percentage));
}

describe("Cálculos Acadêmicos do EduFlow (Motor de Progresso)", () => {
  
  it("deve calcular 50% de progresso no exato meio do semestre", () => {
    const start = new Date("2026-02-01T00:00:00");
    const end = new Date("2026-06-01T00:00:00"); // 120 dias aproximadamente
    const now = new Date("2026-04-02T12:00:00"); // Ponto central aproximado
    
    const progress = calculateSemesterProgress(start, end, now);
    expect(progress).toBeGreaterThanOrEqual(49);
    expect(progress).toBeLessThanOrEqual(51);
  });

  it("não deve permitir progresso negativo se o semestre ainda não começou", () => {
    const start = new Date("2026-03-10");
    const end = new Date("2026-07-10");
    const now = new Date("2026-02-15"); // Antes do início das aulas
    
    const progress = calculateSemesterProgress(start, end, now);
    expect(progress).toBe(0);
  });

  it("deve travar em 100% se a data atual for após o encerramento", () => {
    const start = new Date("2026-01-01");
    const end = new Date("2026-05-30");
    const now = new Date("2026-12-25"); // Natal, muito após o fim das aulas
    
    const progress = calculateSemesterProgress(start, end, now);
    expect(progress).toBe(100);
  });

  it("deve lidar com strings ISO vindas do Supabase", () => {
    const isoStart = parseISO("2026-08-01T00:00:00Z");
    const isoEnd = parseISO("2026-12-01T00:00:00Z");
    const isoNow = parseISO("2026-08-01T23:59:59Z"); // Primeiro dia de aula quase acabando
    
    const progress = calculateSemesterProgress(isoStart, isoEnd, isoNow);
    expect(progress).toBe(0); // No primeiro dia, o progresso ainda é mínimo (0%)
  });

  it("deve retornar 0 se as datas forem inválidas (Início > Fim)", () => {
    const start = new Date("2026-12-01");
    const end = new Date("2026-01-01"); // Data final menor que a inicial
    const now = new Date();
    
    const progress = calculateSemesterProgress(start, end, now);
    expect(progress).toBe(0);
  });
});
