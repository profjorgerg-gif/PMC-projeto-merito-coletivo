// Cálculos do Projeto Mérito Coletivo
export const TRI = ["t1", "t2", "t3"];
export const PER = { t1: "1º Trimestre", t2: "2º Trimestre", t3: "3º Trimestre", anual: "Anual" };

export const r2 = (v) => Math.round(v * 100) / 100;
export const fmt = (v) => (v == null || isNaN(v) ? "—" : v.toFixed(2).replace(".", ","));
export const ordemTurma = (a, b) => a.localeCompare(b, "pt", { numeric: true });

export function normCode(s) {
  const m = String(s).toUpperCase().replace(/\s|-/g, "").match(/^T?(\d{3}[A-Z]?)$/);
  return m ? "T" + m[1] : String(s).toUpperCase().trim();
}

// Média anual parcial = média dos trimestres já lançados
export function anual(t) {
  const v = TRI.map((k) => t.notas && t.notas[k]).filter((x) => typeof x === "number");
  return v.length ? { v: r2(v.reduce((a, b) => a + b, 0) / v.length), n: v.length } : { v: null, n: 0 };
}

export function valorDe(t, p) {
  if (p === "anual") return anual(t).v;
  const x = t.notas && t.notas[p];
  return typeof x === "number" ? x : null;
}

// Classificação do 1º ao último; médias iguais (2 casas) dividem a posição
export function classificar(turmas, p) {
  const lista = Object.values(turmas).map((t) => ({ code: t.codigo, v: valorDe(t, p), t }));
  const com = lista.filter((x) => x.v != null).sort((a, b) => b.v - a.v || ordemTurma(a.code, b.code));
  let ant = null, pos = 0;
  com.forEach((x, i) => {
    if (ant === null || r2(x.v) !== r2(ant)) pos = i + 1;
    x.pos = pos;
    ant = x.v;
  });
  const sem = lista.filter((x) => x.v == null).sort((a, b) => ordemTurma(a.code, b.code));
  return { com, sem };
}

export const periodoAnterior = (p) => (p === "t2" ? "t1" : p === "t3" ? "t2" : null);

// Dados da planilha "Projeto Mérito Coletivo" (atualizada até 20/07/2026)
export const DADOS_PLANILHA = {
  T201: [7.35, 6.14], T202: [7.67, 4.71], T203: [7.56, 5.37], T204: [6.25, 4.83],
  T205: [7.1, 4.69], T206: [5.88, 4.7], T207: [6.15, 5.19], T208: [7.05, 4.99],
  T209: [6.08, 4.31], T210: [6.49, 6.44], T211: [5.75, 4.12],
};
