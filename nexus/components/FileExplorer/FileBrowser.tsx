"use client";

import React, { Suspense, useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileExplorer, type FileItem } from "@/components/FileExplorer/FileExplorer";
import type { SyncStatus } from "@/components/FileExplorer/SyncBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Filter,
  LayoutGrid,
  List,
  ChevronRight,
  Home,
  RefreshCw,
  ArrowLeft,
  FolderPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FileBrowserProps {
  files?: FileItem[];
  title?: string;
  breadcrumbBase?: string;
  apiQueryParams?: Record<string, string>;
  children?: React.ReactNode;
  onCreateFolder?: (name: string, parentId: string | null) => Promise<void>;
  onUploadFile?: (file: File, parentId: string | null) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

function FileBrowserInner({
  files,
  title = "Repository",
  breadcrumbBase = "Repository",
  apiQueryParams,
  children,
  onCreateFolder,
  onUploadFile,
  onRefresh,
}: FileBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [showFilter, setShowFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [syncFilter, setSyncFilter] = useState<"all" | SyncStatus>("all");
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [remoteFiles, setRemoteFiles] = useState<FileItem[]>([]);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentFolderId = folderPath.length > 0 ? folderPath[folderPath.length - 1].id : null;
  const repositoryFiles = files ?? remoteFiles;

  const loadRemoteFiles = useCallback(async () => {
    if (files) {
      return;
    }

    setIsRefreshing(true);
    setLoadError(null);

    try {
      const params = new URLSearchParams(apiQueryParams || {});
      const url = params.size > 0 ? `/api/documents?${params.toString()}` : "/api/documents";

      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Failed to load documents: ${res.status}`);
      }

      const payload = await res.json();
      const items = Array.isArray(payload.items)
        ? (payload.items as FileItem[])
        : [];

      setRemoteFiles(items);
    } catch {
      setRemoteFiles([]);
      setLoadError("Unable to load documents.");
    } finally {
      setIsRefreshing(false);
      setIsInitialLoadComplete(true);
    }
  }, [apiQueryParams, files]);

  useEffect(() => {
    if (files) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void loadRemoteFiles();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [files, loadRemoteFiles]);

  const filteredFiles = repositoryFiles.filter((file) => {
    // Filter by current folder
    const isRoot = currentFolderId === null;
    const matchesFolder = isRoot
      ? file.parentId === null || file.parentId === undefined
      : file.parentId === currentFolderId;

    // Filter by search & sync
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSync = syncFilter === "all" || file.syncStatus === syncFilter;
    
    return matchesFolder && matchesSearch && matchesSync;
  }).sort((a, b) => {
    if (a.type === "folder" && b.type !== "folder") return -1;
    if (a.type !== "folder" && b.type === "folder") return 1;
    return a.name.localeCompare(b.name);
  });

  const handleFolderClick = (folder: FileItem) => {
    const nextPath = [...folderPath, { id: folder.id, name: folder.name }];
    setFolderPath(nextPath);
    setSelectedFile(null);
    updateUrlPath(nextPath, null);
    setSearchQuery(""); // Optional: clear search when navigating
  };

  const handleBreadcrumbClick = (index: number) => {
    const nextPath = folderPath.slice(0, index + 1);
    setFolderPath(nextPath);
    setSelectedFile(null);
    updateUrlPath(nextPath, null);
  };

  const handleHomeClick = () => {
    setFolderPath([]);
    setSelectedFile(null);
    updateUrlPath([], null);
  };

  const handleFileClick = (file: FileItem) => {
    setSelectedFile(file);
    updateUrlPath(folderPath, file);
  };

  const updateUrlPath = (
    nextFolderPath: Array<{ id: string; name: string }>,
    nextSelectedFile: FileItem | null
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    const parts = [breadcrumbBase, ...nextFolderPath.map((folder) => folder.name)];
    if (nextSelectedFile) {
      parts.push(nextSelectedFile.name);
    }

    params.set("path", parts.join("/"));
    if (nextSelectedFile) {
      params.set("fileId", nextSelectedFile.id);
    } else {
      params.delete("fileId");
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (searchParams.has("path")) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("path", breadcrumbBase);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [breadcrumbBase, pathname, router, searchParams]);

  useEffect(() => {
    const fileId = searchParams.get("fileId");
    const q = searchParams.get("q");

    Promise.resolve().then(() => {
      if (fileId) {
        const match = repositoryFiles.find((file) => file.id === fileId) || null;
        if (match) {
          setSelectedFile(match);
        }
      }

      if (q !== null) {
        setSearchQuery(q);
        setShowFilter(true);
      }
    });
  }, [repositoryFiles, searchParams]);

  const handleRefresh = () => {
    if (onRefresh) {
      void onRefresh();
    } else {
      void loadRemoteFiles();
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const upload = async () => {
      setIsUploading(true);
      setLoadError(null);

      try {
        if (onUploadFile) {
          await onUploadFile(file, currentFolderId);
        } else {
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch("/api/documents/upload", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            throw new Error(payload.error || "Upload failed.");
          }
          await loadRemoteFiles();
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to upload document.";
        setLoadError(message);
      } finally {
        setIsUploading(false);
      }
    };

    void upload();
    e.target.value = "";
  };

  return (
    <div className="flex h-full flex-col">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />
      
      {/* ── Top Header Bar ────────────────────────────── */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4 md:px-6">
        <div className="flex items-center gap-2 overflow-hidden">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-sm whitespace-nowrap overflow-x-auto no-scrollbar">
            <button onClick={handleHomeClick} className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
              <Home size={14} />
              <span className="hidden sm:inline">Home</span>
            </button>
            <ChevronRight size={14} className="text-muted-foreground/40" />
            <button 
              onClick={handleHomeClick} 
              className={cn("transition-colors hover:text-foreground", folderPath.length === 0 ? "font-medium text-foreground" : "text-muted-foreground")}
            >
              {breadcrumbBase}
            </button>
            {folderPath.map((folder, index) => (
              <React.Fragment key={folder.id}>
                <ChevronRight size={14} className="text-muted-foreground/40" />
                <button
                  onClick={() => handleBreadcrumbClick(index)}
                  className={cn("transition-colors hover:text-foreground", index === folderPath.length - 1 ? "font-medium text-foreground" : "text-muted-foreground")}
                >
                  {folder.name}
                </button>
              </React.Fragment>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            className="h-8 gap-1.5 text-xs text-muted-foreground hidden sm:flex"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button 
            variant={showFilter ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setShowFilter(!showFilter)}
            className="h-8 gap-1.5 text-xs text-muted-foreground"
          >
            <Filter size={14} />
            <span className="hidden sm:inline">Filter</span>
          </Button>
          <div className="flex rounded-lg border border-border p-0.5">
            <button 
              onClick={() => setViewMode("list")}
              className={`rounded-md p-1.5 transition-colors ${viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List size={14} />
            </button>
            <button 
              onClick={() => setViewMode("grid")}
              className={`rounded-md p-1.5 transition-colors ${viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid size={14} />
            </button>
          </div>
          {onCreateFolder && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                const name = window.prompt("Enter folder name:");
                if (name) void onCreateFolder(name, currentFolderId);
              }}
              className="h-8 gap-1.5"
            >
              <FolderPlus size={14} />
              <span className="hidden sm:inline">New Folder</span>
            </Button>
          )}
          <Button 
            size="sm" 
            onClick={handleUploadClick}
            disabled={isUploading}
            className="h-8 gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
          >
            <Upload size={14} className={isUploading ? "animate-pulse" : ""} />
            <span className="hidden sm:inline">
              {isUploading ? "Uploading..." : "Upload"}
            </span>
          </Button>
        </div>
      </header>

      {/* ── Content ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {children}

        {/* File explorer wrapper */}
        <div className="mb-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {folderPath.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleBreadcrumbClick(folderPath.length - 2)}
                  className="h-8 w-8 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft size={16} />
                </Button>
              )}
              <h1 className="text-lg font-semibold text-foreground">
                {folderPath.length > 0 ? folderPath[folderPath.length - 1].name : title}
              </h1>
              {selectedFile && (
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{filteredFiles.length} items</p>
          </div>
          
          {showFilter && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <Input
                placeholder="Search files by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full max-w-sm bg-card"
              />
              <div className="flex items-center gap-2 text-sm">
                <span className="text-xs text-muted-foreground">Status:</span>
                <select
                  value={syncFilter}
                  onChange={(e) =>
                    setSyncFilter(e.target.value as "all" | SyncStatus)
                  }
                  className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="all">All</option>
                  <option value="synced">Synced</option>
                  <option value="pending">Pending</option>
                  <option value="not-synced">Not Synced</option>
                </select>
              </div>
            </div>
          )}

          {!files && !isInitialLoadComplete && (
            <p className="text-sm text-muted-foreground">
              Loading documents...
            </p>
          )}

          {loadError && (
            <p className="text-sm text-destructive">{loadError}</p>
          )}

          {!files && isInitialLoadComplete && filteredFiles.length === 0 && !loadError && (
            <p className="text-sm text-muted-foreground">
              No documents found.
            </p>
          )}
        </div>
        <FileExplorer
          files={filteredFiles}
          viewMode={viewMode}
          onFolderClick={handleFolderClick}
          onFileClick={handleFileClick}
        />
      </div>
    </div>
  );
}

export function FileBrowser(props: FileBrowserProps) {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-muted-foreground text-sm">Loading...</div>}>
      <FileBrowserInner {...props} />
    </Suspense>
  );
}
