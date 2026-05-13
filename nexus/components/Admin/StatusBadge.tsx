"use client";

import React from "react";
import { cn } from "@/lib/utils";

type StatusType =
  | "active"
  | "inactive"
  | "admin"
  | "user"
  | "connected"
  | "disconnected"
  | "coming-soon";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const STATUS_CONFIG: Record<StatusType, { label: string; classes: string }> = {
  active: {
    label: "Active",
    classes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  },
  inactive: {
    label: "Inactive",
    classes: "bg-red-500/15 text-red-400 border-red-500/25",
  },
  admin: {
    label: "Admin",
    classes: "bg-brand/15 text-brand border-brand/25",
  },
  user: {
    label: "User",
    classes: "bg-muted text-muted-foreground border-border",
  },
  connected: {
    label: "Connected",
    classes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  },
  disconnected: {
    label: "Disconnected",
    classes: "bg-red-500/15 text-red-400 border-red-500/25",
  },
  "coming-soon": {
    label: "Coming Soon",
    classes: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  },
};

/**
 * Color-coded status badge for roles, activity states, and connection status.
 *
 * @example
 * <StatusBadge status="active" />
 * <StatusBadge status="admin" />
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        config.classes,
        className
      )}
    >
      {config.label}
    </span>
  );
}
