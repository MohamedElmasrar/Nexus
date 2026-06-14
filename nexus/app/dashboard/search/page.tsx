"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  Loader2,
  Search,
  Eye,
  Download,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

function getFileIcon(name: string) {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "pdf") return <FileText size={20} className="text-red-400" />;
  if (["xls", "xlsx", "csv", "ods"].includes(ext || ""))
    return <FileSpreadsheet size={20} className="text-emerald-400" />;
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext || ""))
    return <FileImage size={20} className="text-violet-400" />;
  return <File size={20} className="text-muted-foreground" />;
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.searchMyFiles(searchQuery, 15);
      if (res.ok && res.data) {
        setResults(res.data.results || []);
      } else {
        setError("Failed to fetch search results.");
      }
    } catch (e: any) {
      setError(e.message || "An error occurred during search");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setQuery(initialQuery);
    if (initialQuery) {
      void executeSearch(initialQuery);
    } else {
      setResults([]);
    }
  }, [initialQuery, executeSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/dashboard/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    const res = await api.downloadMyFile(filePath);
    if (res.ok && res.data) {
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = decodeURIComponent(fileName);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }
  };

  // Convert distance to a helpful percentage match score
  function getMatchScore(distance: number): string {
    // Cosine distance ranges from 0 (identical) to 2 (opposite)
    // 0.0 - 0.4: Excellent, 0.4 - 0.7: Good, >0.7: Moderate
    const score = Math.max(0, Math.min(100, Math.round((1 - distance) * 100)));
    return `${score}% match`;
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2">
          <Search size={18} className="text-brand" />
          <h1 className="text-sm font-semibold text-foreground">Content Search Engine</h1>
        </div>
      </header>

      {/* Main Search Area */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="mx-auto max-w-4xl space-y-8">
          
          {/* Main Search Box */}
          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={18} />
                <Input
                  className="pl-10 h-11 bg-card border-border/80 focus:border-brand/40 text-sm"
                  placeholder="Query names, phrases, or sentence contents within your documents..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Button type="submit" className="h-11 bg-brand hover:bg-brand/90 px-6 font-medium text-xs gap-1.5 cursor-pointer">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Search
              </Button>
            </div>
          </form>

          {/* Search Result Banner */}
          {initialQuery && (
            <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
              <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                Search Results for <span className="text-foreground font-bold italic">&ldquo;{initialQuery}&rdquo;</span>
                {results.length > 0 && (
                  <span className="text-xs bg-brand/10 border border-brand/20 text-brand px-2 py-0.5 rounded-full font-medium">
                    {results.length} matches
                  </span>
                )}
              </h2>
            </div>
          )}

          {/* Results List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="h-7 w-7 animate-spin text-brand" />
              <span className="text-xs text-muted-foreground">Scanning document index...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-destructive gap-3 bg-destructive/5 rounded-2xl border border-destructive/10 p-6">
              <AlertCircle size={28} />
              <p className="text-xs text-center font-medium">{error}</p>
            </div>
          ) : !initialQuery ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <div className="p-4 bg-muted/20 rounded-full mb-3">
                <Search size={32} className="opacity-40" />
              </div>
              <p className="text-xs font-semibold">Ready to scan document index</p>
              <p className="text-[11px] text-muted-foreground/60 max-w-sm text-center mt-1 leading-relaxed">
                Enter phrases, numbers, or topics to run a similarity vector scan across all indexed document chunks.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border border-border/40 bg-card/10 rounded-2xl text-muted-foreground">
              <AlertCircle size={36} className="opacity-20 mb-3" />
              <p className="text-xs font-medium">No matches found in document content.</p>
              <p className="text-[11px] text-muted-foreground/60 text-center mt-1 max-w-xs leading-relaxed">
                Make sure files containing this text are indexed with AI on their file properties overview page.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((r, idx) => (
                <div
                  key={idx}
                  onClick={() => router.push(`/dashboard/file-info?path=${encodeURIComponent(r.file_path)}`)}
                  className="group flex flex-col md:flex-row justify-between gap-4 p-5 rounded-2xl border border-border/60 bg-card hover:bg-muted/30 hover:border-brand/20 transition-all cursor-pointer shadow-sm hover:shadow-md duration-200"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="mt-0.5 shrink-0">
                      {getFileIcon(r.file_name)}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-foreground group-hover:text-brand transition-colors truncate max-w-[250px]" title={r.file_name}>
                          {r.file_name}
                        </h3>
                        <span className="px-2 py-0.5 text-[9px] font-semibold bg-brand/10 border border-brand/25 text-brand rounded-full uppercase tracking-wider flex items-center gap-1">
                          <Sparkles size={8} />
                          {getMatchScore(r.distance)}
                        </span>
                      </div>
                      
                      {r.snippet && (
                        <p className="text-xs text-muted-foreground/80 leading-relaxed bg-muted/20 border border-border/30 rounded-xl p-3.5 italic font-medium">
                          &ldquo;...{r.snippet}...&rdquo;
                        </p>
                      )}
                      
                      <div className="text-[10px] text-muted-foreground font-mono truncate" title={r.file_path}>
                        Path: {r.file_path}
                      </div>
                    </div>
                  </div>

                  <div className="flex md:flex-col justify-end gap-1.5 shrink-0 self-end md:self-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/file-info?path=${encodeURIComponent(r.file_path)}`);
                      }}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-brand hover:bg-muted"
                      title="View File Details"
                    >
                      <Eye size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDownload(r.file_path, r.file_name);
                      }}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-brand hover:bg-muted"
                      title="Download"
                    >
                      <Download size={15} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
