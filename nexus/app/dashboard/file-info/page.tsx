"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api, type OwnCloudFile, type DocumentSummaryResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Download,
  Trash2,
  Loader2,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  Sparkles,
  Tag,
  Info,
  AlertCircle,
  RefreshCw,
  Star,
  HardDrive,
  Eye,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

function getFileIcon(contentType: string, name: string, size: number = 36) {
  if (contentType?.includes("pdf")) return <FileText size={size} className="text-red-400" />;
  if (contentType?.includes("sheet") || contentType?.includes("excel"))
    return <FileSpreadsheet size={size} className="text-emerald-400" />;
  if (contentType?.includes("image")) return <FileImage size={size} className="text-violet-400" />;
  return <File size={size} className="text-muted-foreground" />;
}

function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtension(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export default function FileInfoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      }
    >
      <FileInfoContent />
    </Suspense>
  );
}

function FileInfoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const filePath = searchParams.get("path") || "";
  const fileName = filePath ? decodeURIComponent(filePath.split("/").filter(Boolean).pop() || "") : "";
  const ext = getExtension(fileName);

  const [fileData, setFileData] = useState<OwnCloudFile | null>(null);
  const [summaryData, setSummaryData] = useState<DocumentSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "ai">("overview");
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  // Preview state
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const isPdf = ext === "pdf";
  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);
  const isText = ["txt", "md", "json", "csv", "py", "js", "ts", "tsx", "html", "css", "xml", "yaml", "yml"].includes(ext);

  // Load file metadata
  useEffect(() => {
    if (!filePath) return;
    const parentPath = filePath.substring(0, filePath.lastIndexOf("/")) || "/";
    api.browseMyFiles(parentPath).then((res) => {
      if (res.ok && Array.isArray(res.data)) {
        const found = res.data.find((f: OwnCloudFile) => f.path === filePath);
        if (found) setFileData(found);
      }
    });
  }, [filePath]);

  // Load preview
  useEffect(() => {
    if (!filePath) return;
    let active = true;
    let localUrl: string | null = null;

    const load = async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      setBlobUrl(null);
      setTextContent(null);
      try {
        const res = await api.downloadMyFile(filePath, true);
        if (!active) return;
        if (!res.ok || !res.data) {
          setPreviewError("Failed to load preview.");
          return;
        }
        if (isImage) {
          const imgBlob = new Blob([res.data], { type: fileData?.content_type || "image/png" });
          localUrl = URL.createObjectURL(imgBlob);
          setBlobUrl(localUrl);
        } else if (isPdf) {
          const pdfBlob = new Blob([res.data], { type: "application/pdf" });
          localUrl = URL.createObjectURL(pdfBlob);
          setBlobUrl(localUrl);
        } else if (isText) {
          setTextContent(await res.data.text());
        }
      } catch (err) {
        const errorVal = err as Error;
        if (active) setPreviewError(errorVal.message || "Preview failed");
      } finally {
        if (active) setPreviewLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [filePath, isImage, isPdf, isText, fileData]);

  // Load AI summary
  const fetchSummary = useCallback(async (forceRefresh?: boolean) => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await api.getFileSummary(filePath, forceRefresh);
      if (res.ok && res.data) setSummaryData(res.data);
      else setSummaryError("Failed to load summary.");
    } catch (err) {
      const errorVal = err as Error;
      setSummaryError(errorVal.message || "Failed to load summary.");
    } finally {
      setSummaryLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    if (filePath) {
      Promise.resolve().then(() => void fetchSummary());
    }
  }, [filePath, fetchSummary]);

  useEffect(() => {
    if (!filePath) return;
    api.listFavorites().then((res) => {
      if (res.ok && Array.isArray(res.data)) {
        setIsFavorite(res.data.some((f) => f.file_path === filePath));
      }
    });
  }, [filePath]);

  // Record view
  useEffect(() => {
    if (filePath && fileName) {
      api.recordView(filePath, fileName).catch(() => {});
    }
  }, [filePath, fileName]);

  const handleIndexFile = async () => {
    setIndexing(true);
    setSummaryError(null);
    try {
      const res = await api.indexFile(filePath);
      if (res.ok) await fetchSummary();
      else setSummaryError("Failed to index file.");
    } catch (err) {
      const errorVal = err as Error;
      setSummaryError(errorVal.message || "Error indexing.");
    } finally {
      setIndexing(false);
    }
  };

  const toggleFavorite = async () => {
    setFavoriteLoading(true);
    try {
      if (isFavorite) {
        await api.removeFavorite(filePath);
        setIsFavorite(false);
      } else {
        await api.addFavorite(filePath, fileName);
        setIsFavorite(true);
      }
    } catch {} finally {
      setFavoriteLoading(false);
    }
  };

  const handleDownload = async () => {
    const res = await api.downloadMyFile(filePath);
    if (res.ok && res.data) {
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
      const res = await api.deleteMyFile(filePath);
      if (res.ok) {
        router.back();
      } else {
        alert("Failed to delete file.");
      }
    }
  };

  if (!filePath) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No file specified.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} />
          </Button>
          <div className="flex items-center gap-2">
            {getFileIcon(fileData?.content_type || "", fileName, 18)}
            <h1 className="text-sm font-semibold text-foreground truncate max-w-[400px]" title={fileName}>
              {fileName}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFavorite}
            disabled={favoriteLoading}
            className={cn(
              "h-8 w-8 p-0 transition-colors",
              isFavorite ? "text-yellow-400 hover:text-yellow-500" : "text-muted-foreground hover:text-yellow-400"
            )}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star size={16} fill={isFavorite ? "currentColor" : "none"} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="h-8 gap-1.5 text-xs"
          >
            <Download size={14} />
            Download
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            className="h-8 gap-1.5 text-xs"
          >
            <Trash2 size={14} />
            Delete
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Document Preview */}
        <div className="flex-1 flex items-center justify-center p-6 bg-muted/5 overflow-hidden">
          {previewLoading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
              <span className="text-xs text-muted-foreground">Loading preview...</span>
            </div>
          ) : previewError ? (
            <div className="max-w-md bg-destructive/10 border border-destructive/20 rounded-xl p-5 text-destructive flex flex-col items-center text-center gap-3 animate-in fade-in duration-200">
              <AlertCircle size={32} />
              <h4 className="font-semibold text-sm">Preview Unavailable</h4>
              <p className="text-xs text-muted-foreground">{previewError}</p>
              <Button size="sm" onClick={handleDownload} className="mt-1 text-xs">
                <Download size={14} className="mr-1.5" />
                Download File
              </Button>
            </div>
          ) : blobUrl && isPdf ? (
            <iframe src={blobUrl} className="w-full h-full rounded-xl bg-background border border-border/50 shadow-inner" title={fileName} />
          ) : blobUrl && isImage ? (
            <img src={blobUrl} alt={fileName} className="max-w-full max-h-full object-contain rounded-xl shadow-lg border border-border" />
          ) : textContent && isText ? (
            <pre className="w-full h-full p-4 bg-muted/20 border border-border/50 rounded-xl font-mono text-xs overflow-auto whitespace-pre-wrap text-foreground">
              {textContent}
            </pre>
          ) : (
            <div className="max-w-md bg-muted/10 border border-border/30 rounded-xl p-6 text-center flex flex-col items-center gap-3">
              <div className="p-3 bg-muted/20 rounded-full">{getFileIcon("", fileName)}</div>
              <h4 className="font-semibold text-foreground text-sm">Preview Not Supported</h4>
              <p className="text-xs text-muted-foreground">Download to view this file.</p>
              <Button size="sm" onClick={handleDownload} className="mt-1 text-xs">
                <Download size={14} className="mr-1.5" />Download
              </Button>
            </div>
          )}
        </div>

        {/* Right: Info Panel */}
        <div className="w-[400px] border-l border-border bg-card/30 backdrop-blur-md flex flex-col h-full overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border bg-muted/20">
            <button
              onClick={() => setActiveTab("overview")}
              className={cn(
                "flex-1 py-3 text-xs font-medium border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
                activeTab === "overview" ? "border-brand text-brand bg-muted/50" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Info size={14} />
              Overview
            </button>
            <button
              onClick={() => setActiveTab("ai")}
              className={cn(
                "flex-1 py-3 text-xs font-medium border-b-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
                activeTab === "ai" ? "border-brand text-brand bg-muted/50" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles size={14} />
              AI Analysis
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {activeTab === "overview" ? (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* File Icon */}
                <div className="flex flex-col items-center py-6 bg-muted/10 rounded-xl border border-border/30">
                  <div className="p-4 bg-muted/30 rounded-xl mb-2">
                    {getFileIcon(fileData?.content_type || "", fileName)}
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{fileData?.content_type || "Unknown Type"}</span>
                </div>

                {/* Properties */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <HardDrive size={12} className="text-brand" />
                    Properties
                  </h4>
                  <div className="bg-muted/10 border border-border/30 rounded-lg p-3 space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span className="text-foreground font-medium truncate max-w-[200px]" title={fileName}>{fileName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Path</span>
                      <span className="text-foreground font-medium truncate max-w-[200px]" title={filePath}>{filePath}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Size</span>
                      <span className="text-foreground font-medium">{fileData ? formatSize(fileData.size) : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Modified</span>
                      <span className="text-foreground font-medium">{fileData?.last_modified || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Status Card */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle size={12} className="text-brand" />
                    AI Sync Status
                  </h4>
                  <div className="bg-muted/10 border border-border/30 rounded-lg p-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-foreground">
                        {summaryData?.indexed ? "Indexed with AI" : "Not Indexed"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {summaryData?.indexed
                          ? "This file's content is searchable by the AI."
                          : "This file is not indexed yet. AI features are unavailable."}
                      </p>
                    </div>
                    {!summaryData?.indexed && (
                      <Button
                        size="sm"
                        onClick={handleIndexFile}
                        disabled={indexing}
                        className="h-8 bg-brand hover:bg-brand/90 text-xs gap-1 cursor-pointer"
                      >
                        {indexing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        Index
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5 animate-in fade-in duration-200">
                {summaryLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-brand" />
                    <span className="text-xs text-muted-foreground">Analyzing file...</span>
                  </div>
                ) : summaryError ? (
                  <div className="bg-muted/10 border border-border/30 rounded-xl p-5 text-center space-y-3">
                    <AlertCircle size={24} className="text-muted-foreground mx-auto" />
                    <p className="text-xs text-muted-foreground">{summaryError}</p>
                    <Button
                      size="sm"
                      onClick={() => void fetchSummary()}
                      className="text-xs"
                      variant="outline"
                    >
                      <RefreshCw size={12} className="mr-1" />
                      Try Again
                    </Button>
                  </div>
                ) : summaryData ? (
                  <div className="space-y-5">
                    {/* Summary */}
                    {summaryData.summary ? (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <FileText size={12} className="text-brand" />
                          Summary
                        </h4>
                        <div className="bg-muted/15 border border-border/30 rounded-xl p-4 text-xs text-foreground/80 leading-relaxed font-medium">
                          {summaryData.summary}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-10 bg-muted/10 border border-border/30 rounded-xl space-y-3">
                        <Sparkles size={28} className="text-brand mx-auto animate-pulse" />
                        <h4 className="font-semibold text-sm text-foreground">AI Analysis Ready</h4>
                        <p className="text-xs text-muted-foreground px-4">
                          Generate tags, bullet takeaways, and a summary.
                        </p>
                        <Button
                          size="sm"
                          onClick={handleIndexFile}
                          disabled={indexing}
                          className="bg-brand hover:bg-brand/90 cursor-pointer text-xs"
                        >
                          {indexing ? <Loader2 size={12} className="animate-spin mr-1" /> : <Sparkles size={12} className="mr-1" />}
                          Analyze File
                        </Button>
                      </div>
                    )}

                    {/* Takeaways */}
                    {summaryData.takeaways && summaryData.takeaways.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Eye size={12} className="text-brand" />
                          Key Takeaways
                        </h4>
                        <ul className="bg-muted/10 border border-border/30 rounded-xl p-4 list-disc list-inside space-y-2 text-xs text-foreground/85 font-medium leading-relaxed">
                          {summaryData.takeaways.map((item, idx) => (
                            <li key={idx} className="marker:text-brand">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Tags */}
                    {summaryData.tags && summaryData.tags.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Tag size={12} className="text-brand" />
                          Auto-Tags
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {summaryData.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand/10 border border-brand/20 text-brand uppercase tracking-wider"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Regenerate */}
                    {summaryData.summary && (
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void fetchSummary(true)}
                          disabled={summaryLoading}
                          className="w-full text-xs py-2 h-auto border-brand/30 text-brand hover:bg-brand/5 transition-colors cursor-pointer"
                        >
                          {summaryLoading ? (
                            <>
                              <Loader2 size={13} className="mr-1.5 animate-spin" />
                              Regenerating Summary...
                            </>
                          ) : (
                            <>
                              <RefreshCw size={13} className="mr-1.5" />
                              Regenerate AI Analysis
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-muted/10 border border-border/30 rounded-xl space-y-2">
                    <AlertCircle size={24} className="text-muted-foreground mx-auto" />
                    <h4 className="text-sm font-semibold text-foreground">No Summary Available</h4>
                    <p className="text-xs text-muted-foreground px-4">This file needs to be indexed before AI analysis can be run.</p>
                    <Button size="sm" onClick={handleIndexFile} disabled={indexing} className="mt-2 text-xs">
                      {indexing ? <Loader2 size={12} className="animate-spin mr-1" /> : <Sparkles size={12} className="mr-1" />}
                      Index and Analyze
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
