"use client";

import { useEffect, useState } from "react";

interface Block {
  id: string;
  name: string;
  critical_question: string;
  trusted_answer: string;
  tags?: string;
  entity_name?: string;
  keywords?: string;
  similarity?: number;
}

interface Arm {
  answer: string;
  sources: any[];
  available?: boolean;
}

interface AskResult {
  blockify?: Arm;
  naive?: Arm;
}

export default function Home() {
  const [tab, setTab] = useState<"add" | "ask">("add");

  return (
    <div className="container">
      <h1>Blockify Demo</h1>
      <p className="subtitle">
        Text → IdeaBlocks <em>and</em> raw chunks → Supabase (pgvector) → compare
        answers side by side.
      </p>

      <div className="tabs">
        <button
          className={`tab ${tab === "add" ? "active" : ""}`}
          onClick={() => setTab("add")}
        >
          Add text
        </button>
        <button
          className={`tab ${tab === "ask" ? "active" : ""}`}
          onClick={() => setTab("ask")}
        >
          Ask questions
        </button>
      </div>

      {tab === "add" ? <AddText /> : <AskQuestions />}
    </div>
  );
}

function AddText() {
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [useDistill, setUseDistill] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [summary, setSummary] = useState("");
  const [stored, setStored] = useState<Block[]>([]);
  const [file, setFile] = useState<File | null>(null);

  async function loadStored() {
    const res = await fetch("/api/blocks");
    const json = await res.json();
    if (res.ok) setStored(json.blocks ?? []);
  }

  useEffect(() => {
    loadStored();
  }, []);

  function applyResult(json: any) {
    setBlocks(json.blockify?.blocks ?? []);
    const pages = json.pages ? `${json.pages} pages · ` : "";
    setSummary(
      `${pages}Blockify: ${json.blockify?.count ?? 0} IdeaBlocks · Naive: ${
        json.naive?.count ?? 0
      } raw chunks`
    );
  }

  async function process() {
    setLoading(true);
    setError("");
    setBlocks([]);
    setSummary("");
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, source: source || undefined, useDistill }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      applyResult(json);
      setText("");
      loadStored();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function uploadPdf() {
    if (!file) return;
    setLoading(true);
    setError("");
    setBlocks([]);
    setSummary("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("useDistill", String(useDistill));
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      applyResult(json);
      setFile(null);
      loadStored();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="panel">
        <textarea
          placeholder="Paste text to ingest…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <input
          type="text"
          placeholder="Source label (optional, e.g. 'Onboarding doc')"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={{ marginTop: 10 }}
        />
        <div className="row">
          <button
            className="primary"
            onClick={process}
            disabled={loading || !text.trim()}
          >
            {loading ? "Processing…" : "Process & save"}
          </button>
          <label className="check">
            <input
              type="checkbox"
              checked={useDistill}
              onChange={(e) => setUseDistill(e.target.checked)}
            />
            Distill (dedupe)
          </label>
        </div>

        <div className="divider">or upload a PDF</div>
        <div className="row">
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            className="primary"
            onClick={uploadPdf}
            disabled={loading || !file}
          >
            {loading ? "Processing…" : "Upload PDF & save"}
          </button>
        </div>

        <p className="subtitle" style={{ margin: "12px 0 0" }}>
          Every ingest populates both stores (IdeaBlocks + raw chunks) from the
          same text.
        </p>
        {error && <div className="error">{error}</div>}
      </div>

      {summary && (
        <div className="panel">
          <strong>{summary}</strong>
          {blocks.map((b) => (
            <BlockCard key={b.id} b={b} />
          ))}
        </div>
      )}

      <div className="panel">
        <strong>Stored IdeaBlocks ({stored.length})</strong>
        {stored.length === 0 ? (
          <p className="empty">Nothing stored yet.</p>
        ) : (
          stored.map((b) => <BlockCard key={b.id} b={b} />)
        )}
      </div>
    </>
  );
}

function AskQuestions() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [source, setSource] = useState("");

  useEffect(() => {
    fetch("/api/sources")
      .then((r) => r.json())
      .then((j) => setSources(j.sources ?? []))
      .catch(() => {});
  }, []);

  async function ask() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, source: source || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      setResult(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="panel">
        <input
          type="text"
          placeholder="Ask a question about your documents…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && question.trim() && ask()}
        />
        <div className="row">
          <button
            className="primary"
            onClick={ask}
            disabled={loading || !question.trim()}
          >
            {loading ? "Thinking…" : "Ask both"}
          </button>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            title="Scope the question to one document"
          >
            <option value="">All documents</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <p className="subtitle" style={{ margin: "10px 0 0" }}>
          Same question, same prompt, same model — the only difference is what
          each method retrieves.
        </p>
        {error && <div className="error">{error}</div>}
      </div>

      {result && (
        <div className="compare">
          <AnswerColumn
            title="Blockify · IdeaBlocks"
            accent
            arm={result.blockify}
            kind="blockify"
          />
          <AnswerColumn
            title="Naive · raw chunks"
            arm={result.naive}
            kind="naive"
          />
        </div>
      )}
    </>
  );
}

function truncate(s: string, n = 240) {
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}

function AnswerColumn({
  title,
  arm,
  kind,
  accent,
}: {
  title: string;
  arm?: Arm;
  kind: "blockify" | "naive";
  accent?: boolean;
}) {
  return (
    <div className="panel">
      <div className={`col-title ${accent ? "accent" : ""}`}>{title}</div>
      <div className="answer">{arm?.answer}</div>
      {arm?.sources && arm.sources.length > 0 && (
        <div className="sources">
          <strong>Retrieved ({arm.sources.length})</strong>
          {arm.sources.map((s: any) => (
            <div className="block" key={s.id}>
              <div className="name">
                {kind === "blockify" ? s.name : "raw chunk"}{" "}
                {typeof s.similarity === "number" && (
                  <span className="sim">({(s.similarity * 100).toFixed(0)}%)</span>
                )}
              </div>
              <div className={kind === "naive" ? "snippet" : ""}>
                {kind === "blockify" ? s.trusted_answer : truncate(s.content)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockCard({ b }: { b: Block }) {
  return (
    <div className="block">
      <div className="name">{b.name}</div>
      <div className="q">{b.critical_question}</div>
      <div>{b.trusted_answer}</div>
      <div className="meta">
        {b.entity_name ? `Entity: ${b.entity_name}` : ""}
        {b.tags ? ` · Tags: ${b.tags}` : ""}
      </div>
    </div>
  );
}
