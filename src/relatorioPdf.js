// Relatório do ranking em PDF, com o cabeçalho oficial da escola na primeira página
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import cabecalho from "./cabecalho.jpg";
import { PER, fmt, anual, valorDe, classificar, ordemTurma } from "./ranking.js";

const NAVY = [22, 51, 111];
const OURO = [246, 231, 189];

async function imagemComoDataUrl(url) {
  const blob = await (await fetch(url)).blob();
  return await new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = erro;
    r.readAsDataURL(blob);
  });
}

const dataBR = (iso) => (iso ? iso.split("-").reverse().join("/") : "");

export async function baixarRelatorioPdf(turmas, config) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const L = pdf.internal.pageSize.getWidth();
  const M = 12;

  // Cabeçalho oficial (proporção 1300 × 505)
  const img = await imagemComoDataUrl(cabecalho);
  const w = L - 2 * M, h = (w * 505) / 1300;
  pdf.addImage(img, "JPEG", M, 10, w, h);
  let y = 10 + h + 9;

  pdf.setFont("helvetica", "bold"); pdf.setFontSize(15); pdf.setTextColor(...NAVY);
  pdf.text("Relatório do Ranking — Projeto Mérito Coletivo 2026", M, y);
  y += 6;
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5); pdf.setTextColor(85, 97, 122);
  const agora = new Date();
  const emitido = agora.toLocaleDateString("pt-BR") + " às " + agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  pdf.text(`${config.atualizadoEm ? "Notas atualizadas até " + dataBR(config.atualizadoEm) + "  ·  " : ""}Emitido em ${emitido}`, M, y);
  y += 7;

  // 1) Classificação anual parcial
  const anualRank = classificar(turmas, "anual");
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(11.5); pdf.setTextColor(...NAVY);
  pdf.text("Classificação anual parcial — Turma Destaque", M, y);
  autoTable(pdf, {
    startY: y + 2.5,
    margin: { left: M, right: M },
    head: [["Posição", "Turma", "Média anual parcial", "Trimestres considerados"]],
    body: [
      ...anualRank.com.map((x) => [x.pos + "º", x.code, fmt(x.v), anual(x.t).n + " de 3"]),
      ...anualRank.sem.map((x) => ["—", x.code, "sem nota", "0 de 3"]),
    ],
    styles: { font: "helvetica", fontSize: 9.5, cellPadding: 1.8 },
    headStyles: { fillColor: NAVY, textColor: 255 },
    columnStyles: { 0: { halign: "center", cellWidth: 22 }, 2: { halign: "right" }, 3: { halign: "center" } },
    didParseCell: (d) => { if (d.section === "body" && d.row.raw[0] === "1º") { d.cell.styles.fillColor = OURO; d.cell.styles.fontStyle = "bold"; } },
  });
  y = pdf.lastAutoTable.finalY + 9;

  // 2) Quadro geral por trimestre
  const ps = ["t1", "t2", "t3", "anual"];
  const R = {};
  ps.forEach((p) => { R[p] = {}; classificar(turmas, p).com.forEach((x) => (R[p][x.code] = x.pos)); });
  const codes = Object.keys(turmas).sort(ordemTurma);
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(11.5); pdf.setTextColor(...NAVY);
  pdf.text("Quadro geral — média e posição por período", M, y);
  autoTable(pdf, {
    startY: y + 2.5,
    margin: { left: M, right: M },
    head: [["Turma", ...ps.flatMap((p) => [p === "anual" ? "Anual" : PER[p].replace("Trimestre", "Tri"), "Pos."])]],
    body: codes.map((c) => [c, ...ps.flatMap((p) => { const v = valorDe(turmas[c], p); return [fmt(v), R[p][c] ? R[p][c] + "º" : "—"]; })]),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 1.6, halign: "center" },
    headStyles: { fillColor: NAVY, textColor: 255 },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
  });
  y = pdf.lastAutoTable.finalY + 6;
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.setTextColor(85, 97, 122);
  pdf.text("Média do trimestre = média aritmética das notas dos estudantes da turma. Média anual parcial = média dos trimestres já lançados.", M, y, { maxWidth: L - 2 * M });
  pdf.text("Classificação da maior para a menor média; médias iguais (2 casas decimais) dividem a posição.", M, y + 4, { maxWidth: L - 2 * M });

  // Rodapé com numeração
  const n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8); pdf.setTextColor(140, 150, 170);
    pdf.text("Projeto Mérito Coletivo · CEDUP Hermann Hering · Prof. Jorge Lima Cardoso", M, 290);
    pdf.text(`Página ${i} de ${n}`, L - M, 290, { align: "right" });
  }
  const d = agora.toLocaleDateString("sv-SE"); // AAAA-MM-DD no fuso local
  pdf.save(`Relatorio_Ranking_Merito_Coletivo_${d}.pdf`);
}
