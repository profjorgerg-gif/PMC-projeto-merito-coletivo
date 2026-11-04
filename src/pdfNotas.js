// Leitura do relatório de notas em PDF e extração das notas por turma
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.js?url";
import { normCode, r2 } from "./ranking.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const NUM = /^(10(?:[.,]0{1,2})?|\d(?:[.,]\d{1,2})?)$/;
const WORD = /[A-Za-zÀ-ÿ]{2,}/;
const SKIPROW = /m[ée]dia\s+(da|geral)|total|turma|professor|disciplina|trimestre|relat[óo]rio|estado de|emitido|p[áa]gina/i;
const HEADER = /^(m[ée]dia|mf|nota|n\d|av\d?|p\d|final|faltas?|freq|estudante|aluno|nome)/i;

function tokensOf(items) {
  const out = [];
  for (const it of items) {
    const s = it.str;
    if (!s || !s.trim()) continue;
    const x0 = it.transform[4], y = it.transform[5], w = it.width || 0, cw = s.length ? w / s.length : 0;
    const re = /\S+/g;
    let m;
    while ((m = re.exec(s))) out.push({ t: m[0], x: x0 + m.index * cw, x2: x0 + (m.index + m[0].length) * cw, y });
  }
  return out;
}

function rowsOf(tokens) {
  const sorted = [...tokens].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const tk of sorted) {
    const r = rows.find((r) => Math.abs(r.y - tk.y) < 3.5);
    if (r) r.tk.push(tk);
    else rows.push({ y: tk.y, tk: [tk] });
  }
  rows.forEach((r) => {
    r.tk.sort((a, b) => a.x - b.x);
    r.text = r.tk.map((t) => t.t).join(" ");
  });
  return rows;
}

function detectTurma(text) {
  let m = text.match(/turma\s*[:\-–]?\s*(T?\s?-?\d{3}[A-Z]?)\b/i);
  if (m) return normCode(m[1]);
  m = text.match(/\bT\s?-?(\d{3})\b/);
  return m ? "T" + m[1] : null;
}

function detectTri(text) {
  const m = text.match(/\b([1-3])\s*[ºo°ª]?\s*tri(?:m|\b)/i);
  return m ? "t" + m[1] : null;
}

async function lerPdf(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const pg = await pdf.getPage(i);
    const tc = await pg.getTextContent();
    const rows = rowsOf(tokensOf(tc.items));
    pages.push({ n: i, rows, text: rows.map((r) => r.text).join("\n") });
  }
  return pages;
}

let seq = 0;
const novoId = () => "r" + ++seq + "-" + Date.now();

function analisar(pages, file) {
  const base = { id: novoId(), file: file.name };
  if (!pages.some((p) => p.rows.length))
    return [{ ...base, kind: "error", msg: "Este PDF não tem texto legível (provavelmente é uma digitalização ou foto). Exporte o relatório em PDF pelo sistema da escola ou use o lançamento manual." }];

  const tri = detectTri(pages.map((p) => p.text).join("\n"));

  // Modo resumo: linhas com código de turma seguido da média
  const resumo = [];
  pages.forEach((p) =>
    p.rows.forEach((r) => {
      const codeTk = r.tk.find((t) => /^T-?\d{3}[A-Z]?$/i.test(t.t));
      if (!codeTk) return;
      const nums = r.tk.filter((t) => t.x > codeTk.x && NUM.test(t.t));
      if (nums.length) resumo.push({ code: normCode(codeTk.t), v: parseFloat(nums[0].t.replace(",", ".")) });
    })
  );

  // Blocos de páginas por turma
  const blocks = [];
  let cur = null;
  pages.forEach((p) => {
    const t = detectTurma(p.text);
    if (!cur || (t && t !== cur.turma)) {
      cur = { turma: t || (cur && cur.turma) || null, pages: [] };
      blocks.push(cur);
    }
    cur.pages.push(p);
  });

  const out = [];
  for (const b of blocks) {
    const rows = b.pages.flatMap((p) => p.rows);
    const header = rows.find((r) => r.tk.filter((t) => HEADER.test(t.t)).length >= 2);
    const students = [];
    for (const r of rows) {
      if (r === header || SKIPROW.test(r.text)) continue;
      const fi = r.tk.findIndex((t) => WORD.test(t.t) && !NUM.test(t.t));
      if (fi < 0) continue;
      let li = fi;
      while (li + 1 < r.tk.length && WORD.test(r.tk[li + 1].t) && !NUM.test(r.tk[li + 1].t)) li++;
      const nameTk = r.tk.slice(fi, li + 1);
      if (nameTk.length < 2) continue;
      const nums = r.tk.slice(li + 1).filter((t) => NUM.test(t.t)).map((t) => ({ x: (t.x + t.x2) / 2, v: parseFloat(t.t.replace(",", ".")) }));
      if (!nums.length) continue;
      students.push({ name: nameTk.map((t) => t.t).join(" "), nums, on: true });
    }
    if (students.length < 3) continue;

    // Agrupa as notas em colunas pela posição horizontal
    const xs = students.flatMap((s) => s.nums.map((n) => n.x)).sort((a, b) => a - b);
    const cl = [];
    xs.forEach((x) => {
      const c = cl[cl.length - 1];
      if (c && x - c.last < 14) { c.sum += x; c.n++; c.last = x; }
      else cl.push({ sum: x, n: 1, last: x });
    });
    const cols = cl.map((c) => ({ x: c.sum / c.n, n: c.n })).filter((c) => c.n >= Math.max(2, students.length * 0.3));
    cols.forEach((c, i) => {
      let best = null;
      if (header) header.tk.forEach((t) => {
        const d = Math.abs((t.x + t.x2) / 2 - c.x);
        if (d < 30 && (!best || d < best.d)) best = { d, t: t.t };
      });
      c.label = (best && best.t) || "Coluna " + (i + 1);
    });
    students.forEach((s) => {
      s.vals = cols.map((c) => { const m = s.nums.find((n) => Math.abs(n.x - c.x) < 14); return m ? m.v : null; });
      delete s.nums;
    });

    // Coluna padrão: "Média" > "Nota" > última que não seja faltas
    let sel = -1;
    cols.forEach((c, i) => { if (/m[ée]dia|^mf$|final/i.test(c.label)) sel = i; });
    if (sel < 0) cols.forEach((c, i) => { if (sel < 0 && /nota/i.test(c.label)) sel = i; });
    if (sel < 0) for (let i = cols.length - 1; i >= 0; i--) if (!/falta|freq/i.test(cols[i].label)) { sel = i; break; }
    if (sel < 0) sel = cols.length - 1;

    out.push({ ...base, id: novoId(), kind: "turma", pages: b.pages.map((p) => p.n), turma: b.turma, tri, cols: cols.map((c) => c.label), sel, students, saved: false });
  }

  if (!out.length && resumo.length >= 2) {
    const uniq = {};
    resumo.forEach((s) => { if (!(s.code in uniq)) uniq[s.code] = s.v; });
    out.push({ ...base, kind: "resumo", tri, items: Object.entries(uniq).map(([code, v]) => ({ code, v, on: true })), saved: false });
  }
  if (!out.length)
    out.push({ ...base, kind: "error", msg: "Não encontrei uma tabela de notas neste PDF. O arquivo precisa ter uma linha por estudante (nome seguido das notas de 0 a 10). Se preferir, lance a média manualmente." });
  return out;
}

export async function extrairNotas(file) {
  try {
    return analisar(await lerPdf(file), file);
  } catch (e) {
    console.warn(e);
    return [{ id: novoId(), file: file.name, kind: "error", msg: "Não consegui abrir este PDF (arquivo protegido ou corrompido)." }];
  }
}

export function mediaDoLancamento(r) {
  const v = r.students.filter((s) => s.on && s.vals[r.sel] != null).map((s) => s.vals[r.sel]);
  return { v: v.length ? r2(v.reduce((a, b) => a + b, 0) / v.length) : null, n: v.length };
}
