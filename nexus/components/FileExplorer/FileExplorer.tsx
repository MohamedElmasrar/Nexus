"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SyncBadge, type SyncStatus } from "./SyncBadge";
import {
  Folder,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileItem {
  id: string;
  name: string;
  type: "folder" | "file";
  mimeType?: string;
  modifiedDate: string;
  modifiedBy: string;
  size?: string;
  syncStatus: SyncStatus;
  parentId?: string | null;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  folder: <Folder size={18} className="text-brand" />,
  pdf: <FileText size={18} className="text-red-400" />,
  spreadsheet: <FileSpreadsheet size={18} className="text-emerald-400" />,
  image: <FileImage size={18} className="text-violet-400" />,
  default: <File size={18} className="text-muted-foreground" />,
};

function getFileIcon(item: FileItem) {
  if (item.type === "folder") return ICON_MAP.folder;
  if (item.mimeType?.includes("pdf")) return ICON_MAP.pdf;
  if (item.mimeType?.includes("sheet") || item.mimeType?.includes("excel"))
    return ICON_MAP.spreadsheet;
  if (item.mimeType?.includes("image")) return ICON_MAP.image;
  return ICON_MAP.default;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface FileExplorerProps {
  files?: FileItem[];
  viewMode?: "list" | "grid";
  onFolderClick?: (folder: FileItem) => void;
  onFileClick?: (file: FileItem) => void;
  renderActions?: (file: FileItem) => React.ReactNode;
}

export function FileExplorer({
  files = [],
  viewMode = "list",
  onFolderClick,
  onFileClick,
  renderActions,
}: FileExplorerProps) {
  const [itemToDelete, setItemToDelete] = useState<FileItem | null>(null);

  const sortedFiles = React.useMemo(() => {
    return [...files].sort((a, b) => {
      const aIsDir = a.type === "folder";
      const bIsDir = b.type === "folder";
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [files]);

  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {sortedFiles.map((file) => (
          <div
            key={file.id}
            onClick={() =>
              file.type === "folder"
                ? onFolderClick?.(file)
                : onFileClick?.(file)
            }
            className="group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-border/80 hover:bg-muted/40 hover:shadow-sm"
          >
            <div className="absolute right-2 top-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
                >
                  <MoreHorizontal size={16} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      if (file.type === "file") {
                        onFileClick?.(file);
                      }
                    }}
                  >
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem>Download</DropdownMenuItem>
                  {file.syncStatus !== "synced" && (
                    <DropdownMenuItem>Force Sync</DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      setItemToDelete(file);
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted/50">
              {getFileIcon(file)}
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="line-clamp-1 text-sm font-medium text-foreground">
                {file.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDate(file.modifiedDate)}
              </span>
            </div>
            <div className="mt-2">
              <SyncBadge status={file.syncStatus} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto">
      <Table className="min-w-[600px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="w-[45%] text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              Name
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              Modified
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              Size
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              Sync to Nexus
            </TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedFiles.map((file) => (
            <TableRow
              key={file.id}
              onClick={() =>
                file.type === "folder"
                  ? onFolderClick?.(file)
                  : onFileClick?.(file)
              }
              className={cn(
                "border-border transition-colors",
                file.type === "folder"
                  ? "cursor-pointer hover:bg-muted/40"
                  : "cursor-pointer hover:bg-muted/20"
              )}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  {getFileIcon(file)}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {file.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {file.modifiedBy}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(file.modifiedDate)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {file.size ?? "—"}
              </TableCell>
              <TableCell>
                <SyncBadge status={file.syncStatus} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 justify-end">
                  {renderActions && renderActions(file)}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground"
                    >
                      <MoreHorizontal size={16} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          if (file.type === "file") {
                            onFileClick?.(file);
                          }
                        }}
                      >
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem>Download</DropdownMenuItem>
                      {file.syncStatus !== "synced" && (
                        <DropdownMenuItem>Force Sync</DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemToDelete(file);
                        }}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete
              <span className="font-semibold text-foreground"> {itemToDelete?.name}</span> and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={() => {
                // Here you would hook up the actual delete API call
                alert(`Mock deleted: ${itemToDelete?.name}`);
                setItemToDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
