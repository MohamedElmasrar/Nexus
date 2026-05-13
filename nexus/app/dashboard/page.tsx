"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { api, type OwnCloudFile } from "@/lib/api";
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
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const path = searchParams.get("path") || "/";
  const currentPath = path;
  const [files, setFiles] = useState<OwnCloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<OwnCloudFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const loadFiles = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.browseMyFiles(path);
      if (!res.ok) {
        setError("Failed to load files. You may not have access.");
        setFiles([]);
        return;
      }
      setFiles(res.data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load files");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteMyFile(deleteTarget.path);
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
    if (!authLoading) {
      void loadFiles(currentPath);
    }
  }, [currentPath, authLoading, loadFiles]);

  const navigateTo = (path: string) => {
    const p = new URLSearchParams();
    p.set("path", path);
    router.push(`/dashboard?${p.toString()}`);
  };

  const handleClick = (file: OwnCloudFile) => {
    if (file.is_directory) {
      navigateTo(file.path);
    }
  };

  const handleDownload = async (file: OwnCloudFile) => {
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

      {/* File List */}
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
                    "border-b border-border/50 transition-colors",
                    file.is_directory
                      ? "cursor-pointer hover:bg-muted/40"
                      : "hover:bg-muted/20"
                  )}
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      {getFileIcon(file)}
                      <span className="text-sm font-medium text-foreground">
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
    </div>
  );
}
