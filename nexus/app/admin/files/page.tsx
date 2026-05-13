"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api, type OwnCloudFile, type OwnCloudGroup, type OwnCloudShare } from "@/lib/api";
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
  Trash2,
  Share2,
  Upload,
  FolderPlus,
  Loader2,
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

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Share Modal ───────────────────────────────────────────────────────────

function ShareModal({
  isOpen,
  onClose,
  path,
}: {
  isOpen: boolean;
  onClose: () => void;
  path: string;
}) {
  const [groups, setGroups] = useState<OwnCloudGroup[]>([]);
  const [shares, setShares] = useState<OwnCloudShare[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [permissions, setPermissions] = useState(1);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    void api.getGroups().then((r) => { if (r.ok) setGroups(r.data); });
    void api.adminGetShares(path).then((r) => { if (r.ok) setShares(r.data); });
  }, [isOpen, path]);

  if (!isOpen) return null;

  const handleShare = async () => {
    if (!selectedGroup) return;
    setSharing(true);
    const res = await api.adminCreateShare(path, 1, selectedGroup, permissions);
    if (res.ok) {
      setShares([...shares, res.data]);
      setSelectedGroup("");
    }
    setSharing(false);
  };

  const handleRemove = async (shareId: number) => {
    await api.adminDeleteShare(shareId);
    setShares(shares.filter((s) => s.id !== shareId));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Share &ldquo;{decodeURIComponent(path.split("/").filter(Boolean).pop() || "/")}&rdquo;
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="mb-6 space-y-2">
          <label className="text-sm font-medium text-foreground">Share with group</label>
          <div className="flex gap-2">
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
            >
              <option value="">Select a group…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <select
              value={permissions}
              onChange={(e) => setPermissions(Number(e.target.value))}
              className="w-28 rounded-md border border-border bg-background px-2 py-2 text-sm"
            >
              <option value={1}>Read</option>
              <option value={15}>Read/Write</option>
              <option value={31}>Full</option>
            </select>
            <Button onClick={handleShare} disabled={!selectedGroup || sharing} size="sm">
              {sharing ? "…" : "Share"}
            </Button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Current Shares</h3>
          {shares.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Not shared yet.</p>
          ) : (
            <ul className="space-y-2">
              {shares.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm bg-muted/30 p-2 rounded-md">
                  <div>
                    <span className="font-medium">{s.share_with_displayname || s.share_with}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({s.share_type === 0 ? "user" : s.share_type === 1 ? "group" : "link"})
                    </span>
                  </div>
                  <button onClick={() => handleRemove(s.id)} className="text-destructive text-xs hover:underline">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
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

// ── Main Page ─────────────────────────────────────────────────────────────

function AdminFilesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentPath = searchParams.get("path") || "/";
  const [files, setFiles] = useState<OwnCloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [shareModalPath, setShareModalPath] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<OwnCloudFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadFiles = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminBrowseFiles(path);
      if (!res.ok) throw new Error("Failed to load files");
      setFiles(res.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFiles(currentPath);
  }, [currentPath, loadFiles]);

  const navigateTo = (path: string) => {
    const p = new URLSearchParams();
    p.set("path", path);
    router.push(`/admin/files?${p.toString()}`);
  };

  const handleClick = (file: OwnCloudFile) => {
    if (file.is_directory) navigateTo(file.path);
  };

  const handleDownload = async (file: OwnCloudFile) => {
    const res = await api.adminDownloadFile(file.path);
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.adminDeleteFile(deleteTarget.path);
      await loadFiles(currentPath);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const path = `${currentPath.replace(/\/$/, "")}/${newFolderName}`;
    await api.adminCreateFolder(path);
    setShowNewFolder(false);
    setNewFolderName("");
    await loadFiles(currentPath);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploading(true);

    for (const f of Array.from(fileList)) {
      const formData = new FormData();
      formData.append("file", f);
      await fetch(
        `/api/nexus?path=${encodeURIComponent(`/api/v1/admin/files/upload?path=${encodeURIComponent(currentPath)}`)}`,
        { method: "POST", body: formData }
      );
    }

    setUploading(false);
    await loadFiles(currentPath);
    e.target.value = "";
  };

  const pathParts = currentPath.split("/").filter(Boolean);

  return (
    <div className="space-y-6">
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        fileName={deleteTarget ? decodeURIComponent(deleteTarget.name) : ""}
        isDeleting={isDeleting}
      />
      {/* Share Modal */}
      <ShareModal
        isOpen={!!shareModalPath}
        onClose={() => setShareModalPath(null)}
        path={shareModalPath || "/"}
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
                <Button variant="outline" onClick={() => setShowNewFolder(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                  className="bg-brand hover:bg-brand/90"
                >
                  Create Folder
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            File Manager
          </h1>
          <p className="text-sm text-muted-foreground">
            Browse, upload, and share files on ownCloud
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setShowNewFolder(true)}
          >
            <FolderPlus size={14} />
            New Folder
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-8 gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
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
      </div>

      {/* New Folder Inline */}
      {showNewFolder && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className="h-8 max-w-xs"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
          />
          <Button size="sm" className="h-8" onClick={handleCreateFolder}>
            Create
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm">
        <button
          onClick={() => navigateTo("/")}
          className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Home size={14} />
          <span>Root</span>
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

      {/* File Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : error ? (
          <div className="py-20 text-center text-sm text-muted-foreground">{error}</div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Folder size={40} strokeWidth={1.2} />
            <p className="mt-3 text-sm">Empty folder</p>
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
                <th className="w-32 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr
                  key={file.path}
                  onClick={() => handleClick(file)}
                  className={cn(
                    "border-b border-border/50 transition-colors group",
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
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShareModalPath(file.path);
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-brand"
                        title="Share"
                      >
                        <Share2 size={14} />
                      </button>
                      {!file.is_directory && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDownload(file);
                          }}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Download"
                        >
                          <Download size={14} />
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

export default function AdminFilesPage() {
  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    }>
      <AdminFilesContent />
    </React.Suspense>
  );
}
