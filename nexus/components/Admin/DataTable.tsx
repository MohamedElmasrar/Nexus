"use client";

import React, { useState, useMemo } from "react";
import { Search, MoreHorizontal, Inbox } from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Column<T> {
  /** Column header label */
  label: string;
  /** Key on the row object, or a render function */
  accessor: keyof T | ((row: T) => React.ReactNode);
  /** Optional className for the column cell */
  className?: string;
}

export interface RowAction<T> {
  label: string;
  icon?: React.ReactNode;
  onClick: (row: T) => void;
  variant?: "default" | "destructive";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  /** Unique key for each row */
  rowKey: keyof T;
  /** Empty state customization */
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
  /** Search */
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  /** Row actions dropdown */
  rowActions?: (row: T) => RowAction<T>[];
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}>
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * Generic data table with search, loading skeleton, empty state, and row actions.
 *
 * @example
 * <DataTable
 *   columns={[
 *     { label: "Name", accessor: "username" },
 *     { label: "Email", accessor: "email" },
 *   ]}
 *   data={users}
 *   rowKey="id"
 *   isLoading={loading}
 *   searchPlaceholder="Search users..."
 *   searchKeys={["username", "email"]}
 *   rowActions={(row) => [
 *     { label: "Edit", onClick: () => editUser(row) },
 *     { label: "Delete", onClick: () => deleteUser(row), variant: "destructive" },
 *   ]}
 * />
 */
export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  isLoading = false,
  rowKey,
  emptyIcon,
  emptyMessage = "No data found",
  searchPlaceholder = "Search...",
  searchKeys,
  rowActions,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");

  const filteredData = useMemo(() => {
    if (!search.trim() || !searchKeys || searchKeys.length === 0) return data;

    const q = search.toLowerCase();
    return data.filter((row) =>
      searchKeys.some((key) => {
        const val = row[key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, searchKeys]);

  const totalCols = columns.length + (rowActions ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      {searchKeys && searchKeys.length > 0 && (
        <div className="relative max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted/50 py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors"
          />
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col, i) => (
                <TableHead
                  key={i}
                  className={`text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 ${col.className ?? ""}`}
                >
                  {col.label}
                </TableHead>
              ))}
              {rowActions && (
                <TableHead className="w-12 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <SkeletonRows cols={totalCols} />
            ) : filteredData.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={totalCols}>
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    {emptyIcon ?? <Inbox size={40} strokeWidth={1.2} />}
                    <p className="mt-3 text-sm">{emptyMessage}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((row) => (
                <TableRow key={String(row[rowKey])}>
                  {columns.map((col, i) => (
                    <TableCell key={i} className={col.className}>
                      {typeof col.accessor === "function"
                        ? col.accessor(row)
                        : (String(row[col.accessor] ?? "") as React.ReactNode)}
                    </TableCell>
                  ))}
                  {rowActions && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-xs">
                              <MoreHorizontal size={14} />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          {rowActions(row).map((action, i) => (
                            <DropdownMenuItem
                              key={i}
                              onSelect={() => action.onClick(row)}
                              className={
                                action.variant === "destructive"
                                  ? "text-destructive focus:text-destructive"
                                  : ""
                              }
                            >
                              {action.icon && (
                                <span className="mr-2">{action.icon}</span>
                              )}
                              {action.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
