import { describe, it, expect } from "vitest";
import { differenceInDays } from "date-fns";

// Simulação da lógica que usamos no Dashboard.tsx
function calculateSemesterProgress(start: Date, end: Date, now: Date) {
  const totalDays = differenceInDays(end, start);
  if (totalDays <= 0) return 0;
  
  const elapsedDays = differenceInDays(now, start);
  const percentage = Math.round((elapsedDays / totalDays) * 100);
  
  return Math.min(100, Math.max(0, percentage));
}

describe("Cálculos Acadêmicos do EduFlow", () => {
  it("deve calcular 50% de progresso no meio do semestre", () => {
    const start = new Date("2026-02-01");
    const end = new Date("2026-06-01"); // 4 meses de duração
    const now = new Date("2026-04-01"); // Exatamente no meio
    
    const progress = calculateSemesterProgress(start, end, now);
    expect(progress).toBe(50);
  });

  it("não deve permitir progresso negativo se o semestre não começou", () => {
    const start = new Date("2026-03-01");
    const end = new Date("2026-07-01");
    const now = new Date("2026-02-01"); // Um mês antes de começar
    
    const progress = calculateSemesterProgress(start, end, now);
    expect(progress).toBe(0);
  });

  it("deve cravar 100% se o semestre já acabou", () => {
    const start = new Date("2026-01-01");
    const end = new Date("2026-05-01");
    const now = new Date("2026-06-01"); // Um mês após o fim
    
    const progress = calculateSemesterProgress(start, end, now);
    expect(progress).toBe(100);
  });
});
