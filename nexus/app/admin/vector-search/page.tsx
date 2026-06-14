"use client";

import React, { useState, useCallback } from "react";
import {
  Search,
  Loader2,
  FileText,
  Hash,
  Sparkles,
  AlertCircle,
  Ruler,
} from "lucide-react";
import { PageHeader } from "@/components/Admin/PageHeader";
import { StatsCard } from "@/components/Admin/StatsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type VectorSearchResult, type VectorSearchResponse } from "@/lib/api";

// ── Distance helpers ────────────────────────────────────────────────────────

/** Cosine distance → 0 = identical, 2 = opposite. Typical useful range 0–1. */
function distanceLabel(d: number): string {
  if (d < 0.3) return "Very Close";
  if (d < 0.5) return "Close";
  if (d < 0.7) return "Moderate";
  if (d < 1.0) return "Distant";
  return "Very Distant";
}

function distanceColor(d: number): string {
  if (d < 0.3) return "text-emerald-400";
  if (d < 0.5) return "text-sky-400";
  if (d < 0.7) return "text-amber-400";
  if (d < 1.0) return "text-orange-400";
  return "text-red-400";
}

function distanceBgColor(d: number): string {
  if (d < 0.3) return "bg-emerald-500/15 border-emerald-500/25";
  if (d < 0.5) return "bg-sky-500/15 border-sky-500/25";
  if (d < 0.7) return "bg-amber-500/15 border-amber-500/25";
  if (d < 1.0) return "bg-orange-500/15 border-orange-500/25";
  return "bg-red-500/15 border-red-500/25";
}

function distanceBarColor(d: number): string {
  if (d < 0.3) return "bg-emerald-500";
  if (d < 0.5) return "bg-sky-500";
  if (d < 0.7) return "bg-amber-500";
  if (d < 1.0) return "bg-orange-500";
  return "bg-red-500";
}

/** Similarity percentage (cosine distance 0→100%, 2→0%) */
function similarityPct(d: number): number {
  return Math.max(0, Math.round((1 - d / 2) * 100));
}

// ── Result count options ────────────────────────────────────────────────────

const RESULT_COUNTS = [5, 10, 15, 20, 30, 50];

// ── Page Component ──────────────────────────────────────────────────────────

export default function VectorSearchPage() {
  const [query, setQuery] = useState("");
  const [nResults, setNResults] = useState(10);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<VectorSearchResult[]>([]);
  const [searchMeta, setSearchMeta] = useState<{
    query: string;
    total: number;
    durationMs: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setSearchMeta(null);

    const t0 = performance.now();
    try {
      const res = await api.vectorSearch(trimmed, nResults);
      const durationMs = Math.round(performance.now() - t0);

      if (!res.ok) {
        setError(
          (res.data as { detail?: string })?.detail || "Search failed. Is the vector store running?"
        );
        return;
      }

      const data = res.data as VectorSearchResponse;
      setResults(data.results);
      setSearchMeta({ query: data.query, total: data.total, durationMs });
    } catch {
      setError("Network error — could not reach the API.");
    } finally {
      setLoading(false);
    }
  }, [query, nResults]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) void handleSearch();
  };

  // Derived stats
  const minDist = results.length
    ? Math.min(...results.map((r) => r.distance))
    : null;
  const maxDist = results.length
    ? Math.max(...results.map((r) => r.distance))
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Vector Search"
        description="Explore the RAG vector store — type any text and inspect retrieved chunks with cosine distance scores"
      />

      {/* ── Search Bar ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50"
            />
            <Input
              id="vector-search-input"
              placeholder="Type a sentence or question to search the vector store…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
            />
          </div>

          {/* Result count selector */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="n-results"
              className="shrink-0 text-xs font-medium text-muted-foreground"
            >
              Results
            </label>
            <select
              id="n-results"
              value={nResults}
              onChange={(e) => setNResults(Number(e.target.value))}
              className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            >
              {RESULT_COUNTS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <Button
            id="vector-search-btn"
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="shrink-0"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Searching…
              </>
            ) : (
              <>
                <Sparkles size={16} className="mr-2" />
                Search Vectors
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-400">
          <AlertCircle size={18} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── Stats Row ───────────────────────────────────────────────────────── */}
      {searchMeta && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            label="Query"
            value={
              searchMeta.query.length > 20
                ? searchMeta.query.slice(0, 20) + "…"
                : searchMeta.query
            }
            icon={<Search size={18} />}
            trend={`${searchMeta.durationMs}ms`}
          />
          <StatsCard
            label="Chunks Found"
            value={searchMeta.total}
            icon={<Hash size={18} />}
            trend={`of ${nResults} requested`}
          />
          <StatsCard
            label="Best Distance"
            value={minDist !== null ? minDist.toFixed(4) : "—"}
            icon={<Sparkles size={18} />}
            trend={minDist !== null ? `${similarityPct(minDist)}% similarity` : ""}
          />
          <StatsCard
            label="Worst Distance"
            value={maxDist !== null ? maxDist.toFixed(4) : "—"}
            icon={<Ruler size={18} />}
            trend={maxDist !== null ? `${similarityPct(maxDist)}% similarity` : ""}
          />
        </div>
      )}

      {/* ── Results List ────────────────────────────────────────────────────── */}
      {searchMeta && results.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
          <Search size={40} className="mb-4 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">
            No chunks found
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            The vector store may be empty — try indexing some files first.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
            Retrieved Chunks
          </h2>

          {results.map((r, idx) => (
            <div
              key={`${r.file_path}-${r.chunk_index}`}
              className="group rounded-xl border border-border bg-card transition-all duration-200 hover:border-brand/30"
            >
              {/* Card Header */}
              <div className="flex flex-wrap items-center gap-3 border-b border-border/50 px-5 py-3">
                {/* Rank */}
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand/10 text-xs font-bold text-brand">
                  {idx + 1}
                </span>

                {/* Distance badge */}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${distanceBgColor(r.distance)} ${distanceColor(r.distance)}`}
                >
                  <span className="font-mono">{r.distance.toFixed(4)}</span>
                  <span className="opacity-70">·</span>
                  <span>{distanceLabel(r.distance)}</span>
                </span>

                {/* Similarity bar */}
                <div className="hidden items-center gap-2 sm:flex">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${distanceBarColor(r.distance)}`}
                      style={{ width: `${similarityPct(r.distance)}%` }}
                    />
                  </div>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {similarityPct(r.distance)}%
                  </span>
                </div>

                {/* File info — pushed right */}
                <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText size={12} />
                    <span className="max-w-[200px] truncate" title={r.file_path}>
                      {r.file_path}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground/60">
                    <Hash size={12} />
                    chunk {r.chunk_index}
                  </span>
                </div>
              </div>

              {/* Chunk text */}
              <div className="px-5 py-4">
                <pre className="whitespace-pre-wrap break-words font-[family-name:var(--font-geist-mono)] text-[13px] leading-relaxed text-foreground/85">
                  {r.text}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty State — no search yet ─────────────────────────────────────── */}
      {!searchMeta && !loading && !error && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-20 text-center">
          <div className="brain-glow mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <Sparkles size={28} />
          </div>
          <p className="text-sm font-medium text-foreground">
            Search the Vector Store
          </p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
            Type any sentence above and hit <kbd className="mx-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold">Enter</kbd> to
            see how ChromaDB retrieves the closest document chunks using cosine
            similarity. Each result shows the raw distance score.
          </p>
        </div>
      )}
    </div>
  );
}
