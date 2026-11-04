import React, { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { auth, db, configurado } from "./firebase.js";
import { TRI, PER, fmt, r2, normCode, ordemTurma, anual, valorDe, classificar, periodoAnterior, DADOS_PLANILHA } from "./ranking.js";
import { extrairNotas, mediaDoLancamento } from "./pdfNotas.js";
import cabecalho from "./cabecalho.jpg";

const hoje = () => new Date().toISOString().slice(0, 10);
const dataBR = (iso) => (iso ? iso.split("-").reverse().join("/") : "");

/* ---------------- gravação ---------------- */
async function gravarNota(code, k, v, fonte) {
  code = normCode(code);
  await setDoc(doc(db, "turmas", code), { codigo: code, notas: { [k]: v }, fontes: { [k]: fonte } }, { merge: true });
  await setDoc(doc(db, "config", "geral"), { atualizadoEm: hoje() }, { merge: true });
}
function msgErro(e) {
  console.warn(e);
  return e && e.code === "permission-denied"
    ? "Seu usuário não tem permissão para alterar o ranking. Confira o e-mail nas regras do Firestore."
    : "Não foi possível gravar agora. Verifique a internet e tente novamente.";
}

/* ---------------- app ---------------- */
export default function App() {
  const [turmas, setTurmas] = useState({});
  const [config, setConfig] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erroDados, setErroDados] = useState("");
  const [user, setUser] = useState(null);
  const [view, setView] = useState(() => location.hash.slice(1) || "ranking");
  const [toast, setToast] = useState("");

  const avisar = (t) => { setToast(t); clearTimeout(avisar._t); avisar._t = setTimeout(() => setToast(""), 3500); };

  useEffect(() => {
    if (!configurado) return;
    const u1 = onAuthStateChanged(auth, setUser);
    const u2 = onSnapshot(collection(db, "turmas"), (snap) => {
      const t = {};
      snap.docs.forEach((d) => { const x = d.data(); t[d.id] = { codigo: d.id, notas: { t1: null, t2: null, t3: null, ...(x.notas || {}) }, fontes: x.fontes || {} }; });
      setTurmas(t); setCarregando(false); setErroDados("");
    }, (e) => { console.warn(e); setCarregando(false); setErroDados("Não foi possível carregar o ranking. Confira as regras do Firestore."); });
    const u3 = onSnapshot(doc(db, "config", "geral"), (d) => setConfig(d.exists() ? d.data() : {}), () => {});
    return () => { u1(); u2(); u3(); };
  }, []);

  useEffect(() => {
    const h = () => setView(location.hash.slice(1) || "ranking");
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);

  const ir = (v) => { setView(v); history.replaceState(null, "", "#" + v); window.scrollTo(0, 0); };
  const v = !user && view !== "ranking" && view !== "login" ? "login" : user && view === "login" ? "lancar" : view;

  if (!configurado) {
    return (
      <Shell>
        <div className="panel stack">
          <h2>Falta conectar o Firebase</h2>
          <p className="note">Abra o arquivo <b>src/firebaseConfig.js</b> no GitHub e cole as 6 chaves do seu projeto Firebase (passo a passo no README do repositório). Depois de salvar, o site é publicado de novo sozinho em 1 a 2 minutos.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      nav={
        <>
          <button aria-selected={v === "ranking"} onClick={() => ir("ranking")}>Ranking</button>
          {user ? (
            <>
              <button aria-selected={v === "lancar"} onClick={() => ir("lancar")}>Lançar notas</button>
              <button aria-selected={v === "turmas"} onClick={() => ir("turmas")}>Turmas</button>
              <button onClick={() => { signOut(auth); ir("ranking"); }} title={user.email}>Sair</button>
            </>
          ) : (
            <button aria-selected={v === "login"} onClick={() => ir("login")}>Área do professor</button>
          )}
        </>
      }
    >
      {erroDados && <div className="status bad">{erroDados}</div>}
      {v === "ranking" && <Ranking turmas={turmas} config={config} carregando={carregando} />}
      {v === "login" && <Login avisar={avisar} />}
      {v === "lancar" && user && <Lancar turmas={turmas} avisar={avisar} />}
      {v === "turmas" && user && <Turmas turmas={turmas} config={config} avisar={avisar} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </Shell>
  );
}

function Shell({ nav, children }) {
  return (
    <>
      <header className="banner"><div className="wrap">
        <img src={cabecalho} alt="Estado de Santa Catarina – CEDUP Hermann Hering – Projeto Mérito Coletivo, Turma Destaque do Ano 2026. Disciplina Gestão de Pessoas, Prof. Jorge Lima Cardoso." />
      </div></header>
      <nav className="tabs"><div className="wrap"><span className="brand">Mérito Coletivo</span>{nav}</div></nav>
      <main className="wrap">{children}</main>
    </>
  );
}

/* ---------------- ranking ---------------- */
function Ranking({ turmas, config, carregando }) {
  const [p, setP] = useState(() => { try { return localStorage.getItem("mc-periodo") || "anual"; } catch { return "anual"; } });
  const escolher = (x) => { setP(x); try { localStorage.setItem("mc-periodo", x); } catch {} };
  const { com, sem } = useMemo(() => classificar(turmas, p), [turmas, p]);
  const ant = periodoAnterior(p);
  const posAnt = useMemo(() => { const m = {}; if (ant) classificar(turmas, ant).com.forEach((x) => (m[x.code] = x.pos)); return m; }, [turmas, ant]);
  const total = Object.keys(turmas).length;
  const empate = com.some((x, i) => i && x.pos === com[i - 1].pos);
  const podio = [com[1], com[0], com[2]];
  const cls = ["p2", "p1", "p3"];

  return (
    <section className="stack" style={{ gap: 24 }}>
      <div className="panel stack">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "end" }}>
          <div className="stack" style={{ gap: 2 }}>
            <span className="eyebrow">{p === "anual" ? "Ranking da média parcial anual" : "Ranking da média do trimestre"}</span>
            <h2>{p === "anual" ? "Turma Destaque 2026 — parcial anual" : PER[p]}</h2>
            {config.atualizadoEm && <span className="note">Atualizado até {dataBR(config.atualizadoEm)}</span>}
          </div>
          <div className="seg" role="group" aria-label="Período">
            {["t1", "t2", "t3", "anual"].map((x) => (
              <button key={x} aria-pressed={p === x} onClick={() => escolher(x)}>{x === "anual" ? "Anual" : x[1] + "º Tri"}</button>
            ))}
          </div>
        </div>

        {total === 0 ? (
          <p className="note">{carregando ? "Carregando as turmas…" : "Nenhuma turma cadastrada ainda."}</p>
        ) : (
          <>
            <div className="podium">
              {podio.map((x, i) => x ? (
                <div key={i} className={"step " + cls[i]}><span className="pos">{x.pos}º</span><span className="code">{x.code}</span><span className="val">{fmt(x.v)}</span></div>
              ) : (
                <div key={i} className={"step empty " + cls[i]}><span className="pos">—</span><span className="muted">sem dados</span></div>
              ))}
            </div>
            <p className="note">
              {p === "anual" ? "Média anual parcial = média aritmética dos trimestres já lançados de cada turma. " : "Média do trimestre = média aritmética das notas dos estudantes da turma. "}
              Classificação do 1º ao último lugar, da maior para a menor média{empate ? "; turmas com a mesma média (2 casas) dividem a posição." : "."}
            </p>
            <ol className="board" aria-label="Classificação completa">
              {com.map((x) => {
                let d = null;
                if (p === "anual") d = <span className="d">{anual(x.t).n} de 3 tri</span>;
                else if (ant && posAnt[x.code]) {
                  const delta = posAnt[x.code] - x.pos;
                  d = delta > 0 ? <span className="d up" title={"Subiu em relação ao " + PER[ant]}>▲ {delta}</span>
                    : delta < 0 ? <span className="d down" title={"Caiu em relação ao " + PER[ant]}>▼ {-delta}</span>
                    : <span className="d" title={"Mesma posição do " + PER[ant]}>= 0</span>;
                }
                return (
                  <li key={x.code} className={x.pos === 1 ? "top1" : ""}>
                    <span className="p">{x.pos}º</span><span className="c">{x.code}</span>
                    <span className="bar" aria-hidden="true"><i style={{ width: Math.max(0, Math.min(100, x.v * 10)) + "%" }} /></span>
                    <span className="v num">{fmt(x.v)}</span>{d || <span className="d" />}
                  </li>
                );
              })}
              {sem.map((x) => (
                <li key={x.code} className="none"><span className="p">—</span><span className="c">{x.code}</span><span className="note">sem nota lançada</span><span className="v num">—</span><span className="d" /></li>
              ))}
            </ol>
          </>
        )}
      </div>
      <Quadro turmas={turmas} />
    </section>
  );
}

function Quadro({ turmas }) {
  const codes = Object.keys(turmas).sort(ordemTurma);
  const ps = ["t1", "t2", "t3", "anual"];
  const R = useMemo(() => { const o = {}; ps.forEach((p) => { o[p] = {}; classificar(turmas, p).com.forEach((x) => (o[p][x.code] = x.pos)); }); return o; }, [turmas]);
  const baixarCsv = () => {
    const linhas = [["Turma", "Média 1º Tri", "Posição 1º Tri", "Média 2º Tri", "Posição 2º Tri", "Média 3º Tri", "Posição 3º Tri", "Média anual parcial", "Posição anual"].join(";")];
    codes.forEach((c) => linhas.push([c, ...ps.flatMap((p) => { const v = valorDe(turmas[c], p); return [v == null ? "" : v.toFixed(2).replace(".", ","), R[p][c] ? R[p][c] + "º" : ""]; })].join(";")));
    const blob = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "Ranking_Merito_Coletivo_2026.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <div className="panel stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="stack" style={{ gap: 2 }}><span className="eyebrow">Quadro geral</span><h3>Média e posição de cada turma por período</h3></div>
        {codes.length > 0 && <button className="btn small" onClick={baixarCsv}>Baixar CSV</button>}
      </div>
      <div className="tblwrap"><table>
        <thead><tr><th>Turma</th>{ps.map((p) => <React.Fragment key={p}><th className="n">{p === "anual" ? "Anual (parcial)" : PER[p]}</th><th className="n">Posição</th></React.Fragment>)}</tr></thead>
        <tbody>
          {codes.map((c) => (
            <tr key={c}><td><b>{c}</b></td>{ps.map((p) => { const pos = R[p][c]; return <React.Fragment key={p}><td className="n">{fmt(valorDe(turmas[c], p))}</td><td className="n">{pos ? (pos <= 3 ? <span className="pill gold">{pos}º</span> : pos + "º") : "—"}</td></React.Fragment>; })}</tr>
          ))}
          {!codes.length && <tr><td colSpan={9} className="muted">Sem turmas.</td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}

/* ---------------- login ---------------- */
function Login({ avisar }) {
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const entrar = async () => {
    setErro(""); setOcupado(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const res = await signInWithPopup(auth, provider);
      avisar("Bem-vindo, " + (res.user.displayName || res.user.email) + ".");
    } catch (err) {
      console.warn(err);
      if (err && (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request")) setErro("");
      else if (err && err.code === "auth/popup-blocked") setErro("O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente de novo.");
      else if (err && err.code === "auth/unauthorized-domain") setErro("Este endereço ainda não está liberado no Firebase (Authentication > Configurações > Domínios autorizados).");
      else setErro("Não foi possível entrar com o Google agora. Tente novamente.");
    }
    setOcupado(false);
  };
  return (
    <div className="panel stack" style={{ maxWidth: 440 }}>
      <div className="stack" style={{ gap: 2 }}><span className="eyebrow">Acesso restrito</span><h2>Área do professor</h2></div>
      <p className="note" style={{ margin: 0 }}>O ranking é público. Para lançar notas, entre com a conta Google do professor. Outras contas conseguem entrar, mas não conseguem alterar o ranking.</p>
      {erro && <div className="status bad">{erro}</div>}
      <div><button className="btn primary" disabled={ocupado} onClick={entrar}>Entrar com Google</button></div>
    </div>
  );
}

/* ---------------- lançar notas ---------------- */
function Lancar({ turmas, avisar }) {
  const [triPadrao, setTriPadrao] = useState("auto");
  const [resultados, setResultados] = useState([]);
  const [status, setStatus] = useState(null);
  const [hover, setHover] = useState(false);
  const codes = Object.keys(turmas).sort(ordemTurma);

  const enviar = async (files) => {
    const lista = [...files].filter((f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
    if (!lista.length) { setStatus({ cls: "warn", t: "Escolha arquivos em PDF." }); return; }
    const novos = [];
    for (const f of lista) { setStatus({ cls: "", t: "Lendo " + f.name + "…" }); novos.push(...(await extrairNotas(f))); }
    setResultados((r) => [...novos, ...r]);
    const ok = novos.filter((r) => r.kind !== "error").length;
    setStatus({ cls: ok ? "ok" : "warn", t: ok ? ok + " lançamento(s) prontos para conferência abaixo." : "Nenhuma tabela de notas reconhecida." });
  };
  const alterar = (id, fn) => setResultados((rs) => rs.map((r) => (r.id === id ? fn(structuredClone(r)) : r)));
  const descartar = (id) => setResultados((rs) => rs.filter((r) => r.id !== id));

  return (
    <section className="stack" style={{ gap: 24 }}>
      <div className="panel stack">
        <div className="stack" style={{ gap: 2 }}><span className="eyebrow">Importar por PDF</span><h2>Lançar notas das turmas</h2></div>
        <p className="note" style={{ margin: 0, maxWidth: "70ch" }}>Envie o relatório de notas em PDF (uma turma por arquivo ou várias turmas no mesmo arquivo). O sistema lê a tabela, identifica a turma e a coluna de média, calcula a média coletiva e mostra tudo para você conferir antes de gravar. Os nomes dos estudantes ficam só na sua tela; o sistema grava apenas a média da turma.</p>
        <label className="field" htmlFor="imp-tri" style={{ width: "fit-content" }}>Trimestre do lançamento
          <select id="imp-tri" value={triPadrao} onChange={(e) => setTriPadrao(e.target.value)}>
            <option value="auto">Detectar no PDF</option>{TRI.map((k) => <option key={k} value={k}>{PER[k]}</option>)}
          </select>
        </label>
        <label className={"drop" + (hover ? " hover" : "")} htmlFor="arquivo"
          onDragOver={(e) => { e.preventDefault(); setHover(true); }} onDragLeave={() => setHover(false)}
          onDrop={(e) => { e.preventDefault(); setHover(false); enviar(e.dataTransfer.files); }}>
          <b>Arraste os PDFs aqui</b><span className="muted">ou clique para escolher os arquivos</span>
          <input type="file" id="arquivo" accept="application/pdf,.pdf" multiple onChange={(e) => { enviar(e.target.files); e.target.value = ""; }} />
        </label>
        {status && <div className={"status " + status.cls}>{status.t}</div>}
      </div>

      {resultados.length > 0 && (
        <div className="stack" style={{ gap: 16 }}>
          {resultados.map((r) => <Resultado key={r.id} r={r} turmas={turmas} codes={codes} triPadrao={triPadrao} alterar={alterar} descartar={descartar} avisar={avisar} />)}
        </div>
      )}

      <Manual codes={codes} avisar={avisar} />
    </section>
  );
}

function Resultado({ r, turmas, codes, triPadrao, alterar, descartar, avisar }) {
  const [salvando, setSalvando] = useState(false);
  const [aberto, setAberto] = useState(false);
  if (r.kind === "error") return (
    <div className="result"><div className="status bad"><b>{r.file}</b> — {r.msg}</div><div><button className="btn small" onClick={() => descartar(r.id)}>Fechar</button></div></div>
  );
  const tri = r.triSel || (triPadrao !== "auto" ? triPadrao : r.tri) || "";
  const TriSel = (
    <label className="field" htmlFor={"tri-" + r.id}>Trimestre
      <select id={"tri-" + r.id} value={tri} onChange={(e) => alterar(r.id, (x) => ((x.triSel = e.target.value), x))}>
        <option value="" disabled>Escolha…</option>{TRI.map((k) => <option key={k} value={k}>{PER[k]}</option>)}
      </select>
    </label>
  );
  const gravar = async () => {
    setSalvando(true);
    try {
      const em = new Date().toISOString();
      if (r.kind === "resumo") { for (const it of r.items.filter((i) => i.on)) await gravarNota(it.code, tri, r2(it.v), { origem: "pdf", arquivo: r.file, em }); }
      else { const a = mediaDoLancamento(r); await gravarNota(r.turma, tri, a.v, { origem: "pdf", arquivo: r.file, alunos: a.n, coluna: r.cols[r.sel], em }); }
      alterar(r.id, (x) => ((x.saved = true), x));
      avisar("Média gravada. O ranking foi recalculado.");
    } catch (e) { avisar(msgErro(e)); }
    setSalvando(false);
  };

  if (r.kind === "resumo") return (
    <div className="result">
      <div className="head"><div className="stack" style={{ gap: 2 }}><span className="eyebrow">{r.file} · resumo por turma</span><h3>{r.items.length} médias de turma encontradas</h3></div><div className="row">{TriSel}</div></div>
      <div className="tblwrap"><table><thead><tr><th>Usar</th><th>Turma</th><th className="n">Média</th></tr></thead><tbody>
        {r.items.map((it, i) => (
          <tr key={it.code} className={it.on ? "" : "off"}><td><input type="checkbox" checked={it.on} aria-label={"Usar " + it.code} onChange={(e) => alterar(r.id, (x) => ((x.items[i].on = e.target.checked), x))} /></td><td><b>{it.code}</b></td><td className="n">{fmt(it.v)}</td></tr>
        ))}
      </tbody></table></div>
      <div className="row">{r.saved ? <span className="pill ok">Gravado no ranking</span> : <button className="btn primary" disabled={!tri || salvando} onClick={gravar}>Gravar médias</button>}<button className="btn small" onClick={() => descartar(r.id)}>Descartar</button></div>
    </div>
  );

  const a = mediaDoLancamento(r);
  const tSel = r.turma || "";
  const opts = [...new Set([...codes, ...(tSel ? [tSel] : [])])].sort(ordemTurma);
  const atual = tSel && tri && turmas[tSel] ? valorDe(turmas[tSel], tri) : null;
  return (
    <div className="result">
      <div className="head">
        <div className="stack" style={{ gap: 2 }}>
          <span className="eyebrow">{r.file} · página{r.pages.length > 1 ? "s" : ""} {r.pages.join(", ")}</span>
          <h3>{tSel || "Turma não identificada"} — {a.n} estudante{a.n === 1 ? "" : "s"} na média</h3>
        </div>
        <div className="stack" style={{ gap: 0, textAlign: "right" }}>
          <span className="eyebrow">Média coletiva calculada</span><span className="bigavg">{fmt(a.v)}</span>
          {atual != null && <span className="note">valor atual no ranking: {fmt(atual)}</span>}
        </div>
      </div>
      <div className="row">
        <label className="field" htmlFor={"tu-" + r.id}>Turma
          <select id={"tu-" + r.id} value={tSel} onChange={(e) => alterar(r.id, (x) => ((x.turma = e.target.value), x))}>
            <option value="" disabled>Escolha…</option>{opts.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        {TriSel}
        <span className="note">Coluna usada: <b>{r.cols[r.sel]}</b> — clique no cabeçalho de outra coluna para trocar.</span>
      </div>
      <details open={aberto} onToggle={(e) => setAberto(e.currentTarget.open)}>
        <summary>Conferir notas lidas do PDF ({r.students.length} linhas)</summary>
        <div className="tblwrap" style={{ marginTop: 8, maxHeight: 360, overflow: "auto" }}><table>
          <thead><tr><th>Usar</th><th>Estudante</th>{r.cols.map((c, ci) => (
            <th key={ci} className={"n colpick" + (ci === r.sel ? " sel" : "")} tabIndex={0} title="Usar esta coluna para a média"
              onClick={() => alterar(r.id, (x) => ((x.sel = ci), x))}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alterar(r.id, (x) => ((x.sel = ci), x)); } }}>
              {c}{ci === r.sel ? " ✓" : ""}</th>))}</tr></thead>
          <tbody>{r.students.map((s, si) => (
            <tr key={si} className={s.on ? "" : "off"}>
              <td><input type="checkbox" checked={s.on} aria-label={"Incluir " + s.name} onChange={(e) => alterar(r.id, (x) => ((x.students[si].on = e.target.checked), x))} /></td>
              <td>{s.name}</td>{s.vals.map((v, ci) => <td key={ci} className={"n" + (ci === r.sel ? " sel" : "")}>{fmt(v)}</td>)}
            </tr>))}</tbody>
        </table></div>
      </details>
      <div className="row">
        {r.saved ? <span className="pill ok">Gravado no ranking</span>
          : <button className="btn primary" disabled={!tSel || !tri || a.v == null || salvando} onClick={gravar}>{atual != null ? "Substituir média no ranking" : "Gravar no ranking"}</button>}
        <button className="btn small" onClick={() => descartar(r.id)}>Descartar</button>
        {(!tSel || !tri) && <span className="note">Escolha a turma e o trimestre para gravar.</span>}
      </div>
    </div>
  );
}

function Manual({ codes, avisar }) {
  const [turma, setTurma] = useState("");
  const [tri, setTri] = useState("t1");
  const [val, setVal] = useState("");
  const t = turma || codes[0] || "";
  const enviar = async (e) => {
    e.preventDefault();
    const v = parseFloat(String(val).replace(",", "."));
    if (!t || isNaN(v) || v < 0 || v > 10) { avisar("Informe uma turma e uma média entre 0 e 10."); return; }
    try { await gravarNota(t, tri, r2(v), { origem: "manual", em: new Date().toISOString() }); setVal(""); avisar(`Média de ${t} no ${PER[tri]} gravada.`); }
    catch (err) { avisar(msgErro(err)); }
  };
  return (
    <div className="panel stack">
      <div className="stack" style={{ gap: 2 }}><span className="eyebrow">Sem PDF</span><h3>Lançamento manual da média</h3></div>
      <p className="note" style={{ margin: 0 }}>Use quando já tiver a média da turma calculada, ou para corrigir um valor.</p>
      <form className="row" style={{ alignItems: "end" }} onSubmit={enviar}>
        <label className="field" htmlFor="m-turma">Turma<select id="m-turma" value={t} onChange={(e) => setTurma(e.target.value)}>{codes.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="field" htmlFor="m-tri">Trimestre<select id="m-tri" value={tri} onChange={(e) => setTri(e.target.value)}>{TRI.map((k) => <option key={k} value={k}>{PER[k]}</option>)}</select></label>
        <label className="field" htmlFor="m-val">Média (0 a 10)<input id="m-val" type="number" min="0" max="10" step="0.01" value={val} onChange={(e) => setVal(e.target.value)} required /></label>
        <button className="btn primary">Gravar média</button>
      </form>
    </div>
  );
}

/* ---------------- turmas ---------------- */
function Turmas({ turmas, config, avisar }) {
  const codes = Object.keys(turmas).sort(ordemTurma);
  const [edits, setEdits] = useState({});
  const [nova, setNova] = useState("");
  const [confirmar, setConfirmar] = useState(null);
  const [data, setData] = useState(config.atualizadoEm || "");
  useEffect(() => { if (config.atualizadoEm) setData(config.atualizadoEm); }, [config.atualizadoEm]);

  const valorCampo = (c, k) => (edits[c] && k in edits[c] ? edits[c][k] : typeof turmas[c].notas[k] === "number" ? String(turmas[c].notas[k]) : "");
  const salvar = async (c) => {
    const notas = {}, fontes = {};
    for (const k of TRI) {
      const raw = valorCampo(c, k).trim();
      const v = raw === "" ? null : r2(parseFloat(raw.replace(",", ".")));
      if (v != null && (isNaN(v) || v < 0 || v > 10)) { avisar("As médias devem ficar entre 0 e 10."); return; }
      const old = typeof turmas[c].notas[k] === "number" ? turmas[c].notas[k] : null;
      if (v !== old) { notas[k] = v; fontes[k] = { origem: "manual", em: new Date().toISOString() }; }
    }
    if (!Object.keys(notas).length) { avisar("Nada mudou em " + c + "."); return; }
    try {
      await setDoc(doc(db, "turmas", c), { notas, fontes }, { merge: true });
      await setDoc(doc(db, "config", "geral"), { atualizadoEm: hoje() }, { merge: true });
      setEdits((e) => { const n = { ...e }; delete n[c]; return n; });
      avisar("Médias de " + c + " salvas.");
    } catch (e) { avisar(msgErro(e)); }
  };
  const adicionar = async (e) => {
    e.preventDefault();
    const c = normCode(nova);
    if (!/^[A-Z0-9]{2,12}$/.test(c)) { avisar("Use só letras e números, como T212."); return; }
    if (turmas[c]) { avisar("A turma " + c + " já está cadastrada."); return; }
    try { await setDoc(doc(db, "turmas", c), { codigo: c, notas: { t1: null, t2: null, t3: null }, fontes: {} }); setNova(""); avisar("Turma " + c + " adicionada."); }
    catch (err) { avisar(msgErro(err)); }
  };
  const remover = async (c) => {
    setConfirmar(null);
    try { await deleteDoc(doc(db, "turmas", c)); avisar("Turma " + c + " removida."); } catch (e) { avisar(msgErro(e)); }
  };
  const carregarPlanilha = async () => {
    try {
      const b = writeBatch(db);
      Object.entries(DADOS_PLANILHA).forEach(([c, [t1, t2]]) =>
        b.set(doc(db, "turmas", c), { codigo: c, notas: { t1, t2, t3: null }, fontes: { t1: { origem: "planilha" }, t2: { origem: "planilha" } } }));
      b.set(doc(db, "config", "geral"), { atualizadoEm: "2026-07-20", ano: 2026 }, { merge: true });
      await b.commit();
      avisar("Dados da planilha carregados: 11 turmas, 1º e 2º trimestres.");
    } catch (e) { avisar(msgErro(e)); }
  };
  const salvarData = async () => {
    if (!data) return;
    try { await setDoc(doc(db, "config", "geral"), { atualizadoEm: data }, { merge: true }); avisar("Data atualizada."); } catch (e) { avisar(msgErro(e)); }
  };

  return (
    <section className="stack" style={{ gap: 24 }}>
      <div className="panel stack">
        <div className="stack" style={{ gap: 2 }}><span className="eyebrow">Cadastro</span><h2>Turmas participantes</h2></div>
        {codes.length === 0 && (
          <div className="status warn row" style={{ justifyContent: "space-between" }}>
            <span>O banco está vazio. Carregue as 11 turmas com as médias do 1º e 2º trimestre da planilha original.</span>
            <button className="btn primary small" onClick={carregarPlanilha}>Carregar dados da planilha</button>
          </div>
        )}
        <div className="tblwrap"><table>
          <thead><tr><th>Turma</th><th className="n">1º Tri</th><th className="n">2º Tri</th><th className="n">3º Tri</th><th>Origem do último lançamento</th><th /></tr></thead>
          <tbody>
            {codes.map((c) => {
              const f = turmas[c].fontes || {};
              const ult = TRI.map((k) => (f[k] ? { k, ...f[k] } : null)).filter(Boolean).pop();
              const orig = ult ? `${PER[ult.k]}: ${ult.origem === "pdf" ? "PDF " + (ult.arquivo || "") + (ult.alunos ? ` (${ult.alunos} estudantes)` : "") : ult.origem === "manual" ? "manual" : "planilha"}` : "—";
              return (
                <React.Fragment key={c}>
                  <tr>
                    <td><b>{c}</b></td>
                    {TRI.map((k) => (
                      <td key={k} className="n"><input type="number" min="0" max="10" step="0.01" id={`ed-${c}-${k}`} aria-label={`${c} ${PER[k]}`} value={valorCampo(c, k)}
                        onChange={(e) => setEdits((ed) => ({ ...ed, [c]: { ...(ed[c] || {}), [k]: e.target.value } }))} /></td>
                    ))}
                    <td className="note">{orig}</td>
                    <td><button className="btn small" onClick={() => salvar(c)}>Salvar</button> <button className="btn small danger" onClick={() => setConfirmar(c)}>Remover</button></td>
                  </tr>
                  {confirmar === c && (
                    <tr><td colSpan={6}><div className="confirmbar">Remover a turma {c} e todas as suas médias?
                      <button className="btn small danger" onClick={() => remover(c)}>Remover definitivamente</button>
                      <button className="btn small" onClick={() => setConfirmar(null)}>Cancelar</button></div></td></tr>
                  )}
                </React.Fragment>
              );
            })}
            {!codes.length && <tr><td colSpan={6} className="muted">Nenhuma turma cadastrada.</td></tr>}
          </tbody>
        </table></div>
        <form className="row" style={{ alignItems: "end" }} onSubmit={adicionar}>
          <label className="field" htmlFor="nova-turma">Nova turma<input type="text" id="nova-turma" placeholder="T212" maxLength={12} value={nova} onChange={(e) => setNova(e.target.value)} required /></label>
          <button className="btn">Adicionar turma</button>
        </form>
        <div className="row" style={{ alignItems: "end" }}>
          <label className="field" htmlFor="dt-atual">Data exibida em “Atualizado até”<input type="date" id="dt-atual" value={data} onChange={(e) => setData(e.target.value)} /></label>
          <button className="btn" onClick={salvarData}>Salvar data</button>
        </div>
      </div>
    </section>
  );
}
