"use client";

import React, { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
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
  Eye,
  ArrowLeft,
  Users,
  Info,
  Calendar,
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

// Delete Confirmation Modal
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
          <h2 className="text-lg font-semibold text-foreground">Delete Project File</h2>
          <p className="mt-2 text-sm text-muted-foreground text-balance">
            Are you sure you want to delete <span className="font-semibold text-foreground">&ldquo;{fileName}&rdquo;</span>? This action cannot be undone.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={isDeleting} className="sm:flex-1">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting} className="sm:flex-1">
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const projectId = Number(resolvedParams.id);
  return <ProjectContent projectId={projectId} />;
}

function ProjectContent({ projectId }: { projectId: number }) {
  const router = useRouter();

  // Project data states
  const [project, setProject] = useState<any | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);

  // File explorer states
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [files, setFiles] = useState<OwnCloudFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Upload and Create folder states
  const [uploading, setUploading] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete states
  const [deleteTarget, setDeleteTarget] = useState<OwnCloudFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Show project info modal
  const [showInfo, setShowInfo] = useState(false);

  // Fetch project details
  const loadProject = useCallback(async () => {
    setProjectLoading(true);
    try {
      const res = await api.getProject(projectId);
      if (res.ok && res.data) {
        setProject(res.data);
      } else {
        setError("Project not found.");
      }
    } catch (e: any) {
      setError(e.message || "Failed to load project details");
    } finally {
      setProjectLoading(false);
    }
  }, [projectId]);

  // Fetch files inside project root folder
  const loadFiles = useCallback(async (path: string) => {
    setFilesLoading(true);
    setError(null);
    try {
      const res = await api.browseProjectFiles(projectId, path);
      if (res.ok && res.data) {
        // Sort folders-first
        const sorted = [...res.data].sort((a, b) => {
          const aIsDir = a.is_directory;
          const bIsDir = b.is_directory;
          if (aIsDir && !bIsDir) return -1;
          if (!aIsDir && bIsDir) return 1;
          return a.name.localeCompare(b.name);
        });
        setFiles(sorted);
      } else {
        setError("Failed to load project files.");
      }
    } catch (e: any) {
      setError(e.message || "Failed to fetch files");
    } finally {
      setFilesLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  useEffect(() => {
    void loadFiles(currentPath);
  }, [currentPath, loadFiles]);

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
  };

  const handleFolderClick = (file: OwnCloudFile) => {
    const nextPath = currentPath === "/" ? `/${file.name}` : `${currentPath.replace(/\/$/, "")}/${file.name}`;
    handleNavigate(nextPath);
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
      const relativePath = currentPath === "/" ? newFolderName.trim() : `${currentPath.replace(/\/$/, "")}/${newFolderName.trim()}`;
      await api.createProjectFolder(projectId, relativePath);
      setShowNewFolder(false);
      setNewFolderName("");
      await loadFiles(currentPath);
    } catch (e: any) {
      alert(e.message || "Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploading(true);

    try {
      for (const f of Array.from(fileList)) {
        const formData = new FormData();
        formData.append("file", f);
        await api.uploadProjectFile(projectId, currentPath, formData);
      }
      await loadFiles(currentPath);
    } catch (e: any) {
      alert(e.message || "Failed to upload file(s)");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const pathParts = currentPath.split("/").filter(Boolean);

  if (projectLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
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
                New Project Folder
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
                  Create
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Project Info Panel Modal */}
      {showInfo && project && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl border border-border animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Info size={18} className="text-brand" />
                Project Specifications
              </h2>
              <button onClick={() => setShowInfo(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Project Name</span>
                <span className="text-foreground font-medium">{project.name}</span>
              </div>
              {project.description && (
                <div>
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Description</span>
                  <span className="text-muted-foreground leading-relaxed">{project.description}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1">ownCloud Group</span>
                  <span className="text-foreground font-mono bg-muted/40 px-2 py-0.5 rounded text-xs inline-block">{project.group_id}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Created By</span>
                  <span className="text-foreground font-medium">{project.created_by}</span>
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <Users size={13} />
                  Group Members ({project.members?.length || 0})
                </span>
                <div className="max-h-36 overflow-y-auto border border-border bg-muted/20 rounded-lg p-2.5 space-y-1">
                  {project.members && project.members.length > 0 ? (
                    project.members.map((member: string) => (
                      <div key={member} className="text-xs text-foreground/80 flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                        {member}
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground/50 italic">No members found in group.</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <Button onClick={() => setShowInfo(false)} className="bg-brand text-brand-foreground hover:bg-brand/90 px-5">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} />
          </Button>
          <div className="flex items-center gap-2">
            <HardDrive size={18} className="text-brand" />
            <h1 className="text-sm font-semibold text-foreground">
              Project: <span className="text-brand font-bold">{project?.name}</span>
            </h1>
          </div>
          <button
            onClick={() => setShowInfo(true)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ml-1"
            title="Project Information"
          >
            <Info size={15} />
          </button>
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

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 border-b border-border px-6 py-2 text-sm">
        <button
          onClick={() => handleNavigate("/")}
          className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Home size={14} />
          <span>Project Root</span>
        </button>
        {pathParts.map((part, index) => {
          const fullPath = "/" + pathParts.slice(0, index + 1).join("/");
          const isLast = index === pathParts.length - 1;
          return (
            <React.Fragment key={fullPath}>
              <ChevronRight size={14} className="text-muted-foreground/40" />
              <button
                onClick={() => handleNavigate(fullPath)}
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

      {/* Main File Listing */}
      <div className="flex-1 overflow-y-auto">
        {filesLoading ? (
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
            <p className="mt-3 text-sm">This project directory is empty</p>
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
                  onClick={() => file.is_directory ? handleFolderClick(file) : router.push(`/dashboard/file-info?path=${encodeURIComponent(file.path)}`)}
                  className={cn(
                    "border-b border-border/50 transition-colors cursor-pointer hover:bg-muted/20",
                    file.is_directory && "hover:bg-muted/40"
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
    </div>
  );
}
