const adjectives = [
  "Calouro", "Veterano", "Focado", "Soneca", "Cafezinho", 
  "Estratégico", "Pragmático", "Teórico", "Prático", "Noturno",
  "Apressado", "Desesperado", "Tranquilo", "Curioso", "Fretado",
  "Concurseiro", "Lendário", "Sobrevivente", "Resiliente", "Atento"
];

const nouns = [
  "Economista", "Calculista", "Analista", "Pesquisador", "Estatístico", 
  "Financista", "Estudioso", "Academico", "Bolsista", "Auditor",
  "Engenheiro", "Filósofo", "Historiador", "Programador", "Jurista",
  "Biólogo", "Matemático", "Contador", "Arquiteto", "Sociólogo"
];

export function generateRandomCodename(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomNum = Math.floor(100 + Math.random() * 900); // Ex: 409
  return `${adj} ${noun} #${randomNum}`;
}
