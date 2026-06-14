"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { api, type OwnCloudFile, type DocumentSummaryResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Folder,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  Home,
  ChevronRight,
  Download,
  HardDrive,
  Loader2,
  Upload,
  Trash2,
  FolderPlus,
  X,
  Tag,
  Sparkles,
  AlertCircle,
  Clock,
  Info,
  Eye,
  RefreshCw,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

function getFileIcon(file: OwnCloudFile) {
  if (file.is_directory) return <Folder size={18} className="text-brand" />;
  if (file.content_type?.includes("pdf")) return <FileText size={18} className="text-red-400" />;
  if (file.content_type?.includes("sheet") || file.content_type?.includes("excel"))
    return <FileSpreadsheet size={18} className="text-emerald-400" />;
  if (file.content_type?.includes("image")) return <FileImage size={18} className="text-violet-400" />;
  return <File size={18} className="text-muted-foreground" />;
}

// ── Delete Modal ──────────────────────────────────────────────────────────

function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  fileName,
  isDeleting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fileName: string;
  isDeleting: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl border border-border animate-in fade-in zoom-in duration-200">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Trash2 size={24} />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Delete File</h2>
          <p className="mt-2 text-sm text-muted-foreground text-balance">
            Are you sure you want to delete <span className="font-semibold text-foreground">&ldquo;{fileName}&rdquo;</span>? This action cannot be undone.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            className="sm:flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            className="sm:flex-1"
          >
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DashboardPage() {
  return (
    <React.Suspense fallback={
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    }>
      <DashboardContent />
    </React.Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const { isLoading: authLoading, isLoggedIn } = useAuth();
  const router = useRouter();

  const [currentPath, setCurrentPath] = useState<string>(
    searchParams.get("path") || "/"
  );
  const [files, setFiles] = useState<OwnCloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<OwnCloudFile | null>(null);
  const [previewTarget, setPreviewTarget] = useState<OwnCloudFile | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<OwnCloudFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Favorites state and handlers
  const [favorites, setFavorites] = useState<string[]>([]);

  const loadFavorites = useCallback(async () => {
    try {
      const res = await api.listFavorites();
      if (res.ok && res.data) {
        setFavorites(res.data.map((f) => f.file_path));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleToggleFavorite = async (file: OwnCloudFile, e: React.MouseEvent) => {
    e.stopPropagation();
    const isFav = favorites.includes(file.path);
    try {
      if (isFav) {
        const res = await api.removeFavorite(file.path);
        if (res.ok) {
          setFavorites((prev) => prev.filter((p) => p !== file.path));
        }
      } else {
        const res = await api.addFavorite(file.path, file.name);
        if (res.ok) {
          setFavorites((prev) => [...prev, file.path]);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const nextPath = searchParams.get("path") || "/";
    Promise.resolve().then(() => setCurrentPath(nextPath));
  }, [searchParams]);

  const loadFiles = useCallback(async (path: string) => {
    if (!isLoggedIn) {
      setFiles([]);
      setLoading(false);
      setError("Please sign in to view your files.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.browseMyFiles(path);
      if (!res.ok) {
        const detail =
          res.data && typeof res.data === "object" && "detail" in res.data
            ? String((res.data as { detail?: string }).detail || "")
            : "";
        setError(detail || "Failed to load files. You may not have access.");
        setFiles([]);
        return;
      }

      if (!Array.isArray(res.data)) {
        setError("Unexpected response while loading files.");
        setFiles([]);
        return;
      }

      const sortedFiles = [...(res.data || [])].sort((a, b) => {
        const aIsDir = a.is_directory;
        const bIsDir = b.is_directory;
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.name.localeCompare(b.name);
      });
      setFiles(sortedFiles);
    } catch (e) {
      const err = e as Error;
      setError(err.message || "Failed to load files");
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteMyFile(deleteTarget.path);
      setFiles((prev) => prev.filter((f) => f.path !== deleteTarget.path));
      await loadFiles(currentPath);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const fullPath = `${currentPath.replace(/\/$/, "")}/${newFolderName.trim()}`;
      await api.createMyFolder(fullPath);
      setShowNewFolder(false);
      setNewFolderName("");
      await loadFiles(currentPath);
    } finally {
      setCreatingFolder(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isLoggedIn) {
      Promise.resolve().then(() => {
        void loadFiles(currentPath);
        void loadFavorites();
      });
    }
  }, [currentPath, authLoading, isLoggedIn, loadFiles, loadFavorites]);

  useEffect(() => {
    Promise.resolve().then(() => {
      setSelectedFile(null);
      setPreviewTarget(null);
    });
  }, [currentPath]);

  const navigateTo = (path: string) => {
    const p = new URLSearchParams();
    p.set("path", path);
    setCurrentPath(path);
    router.push(`/dashboard?${p.toString()}`);
  };

  const handleClick = (file: OwnCloudFile) => {
    if (file.is_directory) {
      navigateTo(file.path);
    } else {
      router.push(`/dashboard/file-info?path=${encodeURIComponent(file.path)}`);
    }
  };

  const handleDownload = async (file: OwnCloudFile) => {
    void api.recordView(file.path, file.name).catch(() => {});
    const res = await api.downloadMyFile(file.path);
    if (res.ok && res.data) {
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = decodeURIComponent(file.name);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploading(true);

    for (const f of Array.from(fileList)) {
      const formData = new FormData();
      formData.append("file", f);
      await fetch(
        `/api/nexus?path=${encodeURIComponent(`/api/v1/users/me/files/upload?path=${encodeURIComponent(currentPath)}`)}`,
        { method: "POST", body: formData }
      );
    }

    setUploading(false);
    await loadFiles(currentPath);
    e.target.value = "";
  };

  // Breadcrumb
  const pathParts = currentPath.split("/").filter(Boolean);

  return (
    <div className="flex h-full flex-col">
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        fileName={deleteTarget ? decodeURIComponent(deleteTarget.name) : ""}
        isDeleting={isDeleting}
      />

      {previewTarget && (
        <DocumentPreviewModal
          file={previewTarget}
          onClose={() => setPreviewTarget(null)}
          onDownload={() => handleDownload(previewTarget)}
          onDelete={() => {
            const t = previewTarget;
            setPreviewTarget(null);
            setDeleteTarget(t);
          }}
        />
      )}

      {/* New Folder Modal */}
      {showNewFolder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl border border-border animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <FolderPlus size={20} className="text-brand" />
                New Folder
              </h2>
              <button onClick={() => setShowNewFolder(false)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Folder Name</label>
                <Input
                  autoFocus
                  placeholder="Enter folder name..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                  className="bg-muted/30"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setShowNewFolder(false)} disabled={creatingFolder}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim() || creatingFolder}
                  className="bg-brand hover:bg-brand/90"
                >
                  {creatingFolder ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create Folder
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2">
          <HardDrive size={18} className="text-brand" />
          <h1 className="text-sm font-semibold text-foreground">My Files</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            onClick={() => setShowNewFolder(true)}
          >
            <FolderPlus size={14} />
            New Folder
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-8 gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer shadow-sm shadow-brand/20 transition-all"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={14} />
            {uploading ? "Uploading…" : "Upload"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </div>
      </header>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 border-b border-border px-6 py-2 text-sm">
        <button
          onClick={() => navigateTo("/")}
          className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Home size={14} />
          <span>Home</span>
        </button>
        {pathParts.map((part, index) => {
          const fullPath = "/" + pathParts.slice(0, index + 1).join("/");
          const isLast = index === pathParts.length - 1;
          return (
            <React.Fragment key={fullPath}>
              <ChevronRight size={14} className="text-muted-foreground/40" />
              <button
                onClick={() => navigateTo(fullPath)}
                className={cn(
                  "transition-colors hover:text-foreground",
                  isLast ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {decodeURIComponent(part)}
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Main Content Area: File List + Side Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: Scrollable File List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <p className="text-sm">{error}</p>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Folder size={40} strokeWidth={1.2} />
              <p className="mt-3 text-sm">This folder is empty</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Name
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Size
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Modified
                  </th>
                  <th className="w-16 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr
                    key={file.path}
                    onClick={() => handleClick(file)}
                    className={cn(
                      "border-b border-border/50 transition-colors cursor-pointer",
                      file.is_directory
                        ? "hover:bg-muted/40"
                        : selectedFile?.path === file.path
                        ? "bg-brand/10 hover:bg-brand/15"
                        : "hover:bg-muted/20"
                    )}
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        {getFileIcon(file)}
                        <span className="text-sm font-medium text-foreground max-w-[250px] truncate block" title={decodeURIComponent(file.name)}>
                          {decodeURIComponent(file.name)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {file.is_directory ? "—" : formatSize(file.size)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {file.last_modified || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {!file.is_directory && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/file-info?path=${encodeURIComponent(file.path)}`);
                              }}
                              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-brand"
                              title="View File Details"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                void handleToggleFavorite(file, e);
                              }}
                              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                              title={favorites.includes(file.path) ? "Remove from Favorites" : "Add to Favorites"}
                            >
                              <Star
                                size={16}
                                className={cn(
                                  favorites.includes(file.path)
                                    ? "text-yellow-400 fill-yellow-400"
                                    : "text-muted-foreground hover:text-yellow-400"
                                )}
                              />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDownload(file);
                              }}
                              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-brand"
                              title="Download"
                            >
                              <Download size={16} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(file);
                          }}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right Side: Collapsible Side Panel (Removed in favor of dedicated file-info page) */}
      </div>
    </div>
  );
}

// ── FileSidePanel Component ──────────────────────────────────────────────────

interface FileSidePanelProps {
  file: OwnCloudFile;
  onClose: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onPreview?: () => void;
  hideClose?: boolean;
}

function FileSidePanel({
  file,
  onClose,
  onDownload,
  onDelete,
  onPreview,
  hideClose = false,
}: FileSidePanelProps) {
  const [activeTab, setActiveTab] = useState<"info" | "ai">("info");
  const [summaryData, setSummaryData] = useState<DocumentSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async (forceRefresh?: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getFileSummary(file.path, forceRefresh);
      if (res.ok && res.data) {
        setSummaryData(res.data);
      } else {
        setError("Failed to load summary.");
      }
    } catch (err) {
      const errorVal = err as Error;
      setError(errorVal.message || "Failed to load summary.");
    } finally {
      setLoading(false);
    }
  }, [file.path]);

  useEffect(() => {
    if (activeTab === "ai") {
      Promise.resolve().then(() => void fetchSummary());
    }
  }, [activeTab, fetchSummary]);

  const handleIndexFile = async () => {
    setIndexing(true);
    setError(null);
    try {
      const res = await api.indexFile(file.path);
      if (res.ok) {
        // Success indexing, now load summary
        await fetchSummary();
      } else {
        setError("Failed to index file. Make sure file content is readable.");
      }
    } catch (err) {
      const errorVal = err as Error;
      setError(errorVal.message || "Error indexing document.");
    } finally {
      setIndexing(false);
    }
  };

  return (
    <div className="w-[400px] border-l border-border/50 bg-card/30 backdrop-blur-md flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden mr-2">
          {getFileIcon(file)}
          <h3 className="font-semibold text-foreground text-sm truncate" title={decodeURIComponent(file.name)}>
            {decodeURIComponent(file.name)}
          </h3>
        </div>
        {!hideClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/50 bg-muted/20">
        <button
          onClick={() => setActiveTab("info")}
          className={cn(
            "flex-1 py-2.5 text-xs font-medium border-b-2 flex items-center justify-center gap-1.5 transition-colors",
            activeTab === "info"
              ? "border-brand text-brand"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/10"
          )}
        >
          <Info size={14} />
          Details
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={cn(
            "flex-1 py-2.5 text-xs font-medium border-b-2 flex items-center justify-center gap-1.5 transition-colors",
            activeTab === "ai"
              ? "border-brand text-brand"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/10"
          )}
        >
          <Sparkles size={14} />
          AI Summary
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === "info" ? (
          <div className="space-y-4">
            {/* Big Icon Preview */}
            <div className="flex flex-col items-center justify-center py-6 bg-muted/10 rounded-lg border border-border/30">
              <div className="p-4 bg-muted/30 rounded-xl mb-2">
                {React.cloneElement(getFileIcon(file), { size: 36 })}
              </div>
              <span className="text-xs text-muted-foreground truncate max-w-[280px]">
                {file.content_type || "Unknown Type"}
              </span>
            </div>

            {/* Properties */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Properties</h4>
              <div className="bg-muted/10 border border-border/30 rounded-lg p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Path</span>
                  <span className="text-foreground font-medium truncate max-w-[240px] text-right" title={file.path}>
                    {file.path}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Size</span>
                  <span className="text-foreground font-medium">{formatSize(file.size)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Modified</span>
                  <span className="text-foreground font-medium">{file.last_modified || "—"}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Actions</h4>
              {onPreview && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onPreview}
                  className="w-full text-xs py-1.5 h-auto mb-2 bg-brand text-brand-foreground hover:bg-brand/90 transition-all shadow-sm shadow-brand/10 cursor-pointer"
                >
                  <Eye size={14} className="mr-1.5" />
                  Open Preview Workspace
                </Button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={onDownload} className="text-xs py-1.5 h-auto w-full">
                  <Download size={14} className="mr-1.5" />
                  Download
                </Button>
                <Button variant="destructive" size="sm" onClick={onDelete} className="text-xs py-1.5 h-auto w-full">
                  <Trash2 size={14} className="mr-1.5" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-brand" />
                <span className="text-xs text-muted-foreground">Generating summary with Gemini...</span>
              </div>
            ) : error ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex gap-3 text-destructive">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h5 className="text-xs font-semibold">Error Loading Summary</h5>
                  <p className="text-xs leading-relaxed">{error}</p>
                  <Button size="sm" onClick={() => void fetchSummary()} variant="ghost" className="text-xs h-7 px-2 hover:bg-destructive/10 mt-1">
                    Try Again
                  </Button>
                </div>
              </div>
            ) : summaryData && !summaryData.indexed ? (
              /* Unindexed State */
              <div className="flex flex-col items-center justify-center text-center py-10 px-4 bg-muted/5 border border-border/20 rounded-lg">
                <div className="p-3 bg-brand/10 text-brand rounded-full mb-3">
                  <Sparkles size={24} />
                </div>
                <h4 className="font-semibold text-foreground text-sm mb-1.5">Unindexed Document</h4>
                <p className="text-xs text-muted-foreground mb-4 max-w-[280px]">
                  This document has not been indexed for AI search & analysis. Index it now to generate summaries and query it via chatbot.
                </p>
                <Button size="sm" onClick={handleIndexFile} disabled={indexing} className="w-full max-w-[200px] text-xs">
                  {indexing ? (
                    <>
                      <Loader2 size={14} className="mr-1.5 animate-spin" />
                      Indexing File...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} className="mr-1.5" />
                      Index Document
                    </>
                  )}
                </Button>
              </div>
            ) : summaryData ? (
              /* Indexed Summary Render */
              <div className="space-y-4 animate-in fade-in duration-300">
                {/* Summary */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={12} className="text-brand" />
                    Executive Summary
                  </h4>
                  <div className="bg-muted/10 border border-border/30 rounded-lg p-3">
                    <p className="text-xs leading-relaxed text-foreground/90 font-medium whitespace-pre-wrap">
                      {summaryData.summary}
                    </p>
                  </div>
                </div>

                {/* Key Takeaways */}
                {summaryData.takeaways && summaryData.takeaways.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Clock size={12} className="text-brand" />
                      Key Takeaways
                    </h4>
                    <ul className="space-y-1.5 bg-muted/10 border border-border/30 rounded-lg p-3 list-disc pl-5 text-xs text-foreground/80 leading-relaxed font-medium">
                      {summaryData.takeaways.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Auto-Tags */}
                {summaryData.tags && summaryData.tags.length > 0 && (
                  <div className="space-y-1.5">
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

                {/* Regenerate AI Analysis Button */}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void fetchSummary(true)}
                    disabled={loading}
                    className="w-full text-xs py-2 h-auto border-brand/30 text-brand hover:bg-brand/5 transition-colors cursor-pointer"
                  >
                    {loading ? (
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
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

// ── DocumentPreviewModal Component ───────────────────────────────────────────

interface DocumentPreviewModalProps {
  file: OwnCloudFile;
  onClose: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

function DocumentPreviewModal({
  file,
  onClose,
  onDownload,
  onDelete,
}: DocumentPreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let localUrl: string | null = null;

    const loadContent = async () => {
      setLoading(true);
      setError(null);
      setBlobUrl(null);
      setTextContent(null);
      try {
        const extension = file.name.toLowerCase().split(".").pop();
        const isPdf = file.content_type?.includes("pdf") || extension === "pdf";
        const isImage =
          file.content_type?.includes("image") ||
          ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension || "");
        const isText =
          file.content_type?.includes("text") ||
          file.content_type?.includes("javascript") ||
          file.content_type?.includes("json") ||
          ["txt", "md", "json", "csv", "py", "js", "ts", "tsx", "html", "css", "xml", "yaml", "yml"].includes(extension || "");

        const res = await api.downloadMyFile(file.path, true);
        if (!active) return;
        if (!res.ok || !res.data) {
          setError("Failed to download file content. Please download and view locally.");
          return;
        }

        if (isImage) {
          const imgBlob = new Blob([res.data], { type: file.content_type || "image/png" });
          localUrl = URL.createObjectURL(imgBlob);
          setBlobUrl(localUrl);
        } else if (isPdf) {
          const pdfBlob = new Blob([res.data], { type: "application/pdf" });
          localUrl = URL.createObjectURL(pdfBlob);
          setBlobUrl(localUrl);
        } else if (isText) {
          const txt = await res.data.text();
          setTextContent(txt);
        }
      } catch (err) {
        const errorVal = err as Error;
        if (active) {
          setError(errorVal.message || "Failed to load document preview.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadContent();

    return () => {
      active = false;
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [file]);

  const isPdf = file.content_type?.includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
  const isImage =
    file.content_type?.includes("image") ||
    /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name);
  const isText =
    file.content_type?.includes("text") ||
    file.content_type?.includes("javascript") ||
    file.content_type?.includes("json") ||
    /\.(txt|md|json|csv|py|js|ts|tsx|html|css|xml|yaml|yml)$/i.test(file.name);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-6xl h-[88vh] bg-card rounded-2xl border border-border shadow-2xl flex flex-col sm:flex-row overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Left Side: Document Viewer */}
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          {/* Header */}
          <div className="h-14 border-b border-border/50 px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 overflow-hidden mr-2">
              {getFileIcon(file)}
              <h2 className="text-sm font-semibold text-foreground truncate" title={decodeURIComponent(file.name)}>
                {decodeURIComponent(file.name)}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors sm:hidden"
            >
              <X size={16} />
            </button>
          </div>

          {/* Main Viewer Body */}
          <div className="flex-1 p-4 bg-muted/5 relative overflow-hidden flex items-center justify-center">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-brand" />
                <span className="text-xs text-muted-foreground">Fetching file content...</span>
              </div>
            ) : error ? (
              <div className="max-w-md bg-destructive/10 border border-destructive/20 rounded-xl p-5 text-destructive flex gap-3 flex-col items-center text-center">
                <AlertCircle size={32} />
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">Preview Unavailable</h4>
                  <p className="text-xs leading-relaxed text-muted-foreground">{error}</p>
                </div>
                <Button size="sm" onClick={onDownload} className="mt-2 text-xs py-1.5 h-auto">
                  <Download size={14} className="mr-1.5" />
                  Download File
                </Button>
              </div>
            ) : blobUrl && isPdf ? (
              <iframe
                src={blobUrl}
                className="w-full h-full rounded-xl bg-background border border-border/50 shadow-inner"
                title={file.name}
              />
            ) : blobUrl && isImage ? (
              <div className="w-full h-full flex items-center justify-center p-2">
                <img
                  src={blobUrl}
                  alt={file.name}
                  className="max-w-full max-h-full object-contain rounded-xl shadow-lg border border-border"
                />
              </div>
            ) : textContent && isText ? (
              <div className="w-full h-full relative">
                <pre className="w-full h-full p-4 bg-muted/20 border border-border/50 rounded-xl font-mono text-xs overflow-auto whitespace-pre-wrap text-foreground">
                  {textContent}
                </pre>
              </div>
            ) : (
              <div className="max-w-md bg-muted/10 border border-border/30 rounded-xl p-6 text-center flex flex-col items-center gap-3">
                <div className="p-3 bg-muted/20 rounded-full">
                  {getFileIcon(file)}
                </div>
                <h4 className="font-semibold text-foreground text-sm">Preview Not Supported</h4>
                <p className="text-xs text-muted-foreground">
                  Preview is not supported for this file type ({file.content_type || "unknown"}). You can download and open the file on your device.
                </p>
                <Button size="sm" onClick={onDownload} className="mt-1 text-xs py-1.5 h-auto">
                  <Download size={14} className="mr-1.5" />
                  Download File
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Side Panel (Details + AI Summary) */}
        <div className="w-full sm:w-[360px] shrink-0 border-t sm:border-t-0 sm:border-l border-border bg-card/10 flex flex-col h-full overflow-hidden relative">
          <div className="absolute top-3 right-3 z-10 hidden sm:block">
            <button
              onClick={onClose}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Close Workspace"
            >
              <X size={16} />
            </button>
          </div>
          <FileSidePanel
            file={file}
            onClose={onClose}
            onDownload={onDownload}
            onDelete={onDelete}
            hideClose={true}
          />
        </div>

      </div>
    </div>
  );
}

