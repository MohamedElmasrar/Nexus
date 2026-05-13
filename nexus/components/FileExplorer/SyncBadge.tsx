"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type SyncStatus = "synced" | "pending" | "not-synced";

const config: Record<
  SyncStatus,
  { label: string; className: string; dot: string }
> = {
  synced: {
    label: "Synced",
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15",
    dot: "bg-emerald-400",
  },
  pending: {
    label: "Pending",
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15",
    dot: "bg-amber-400 animate-pulse",
  },
  "not-synced": {
    label: "Not Synced",
    className:
      "border-muted-foreground/20 bg-muted/50 text-muted-foreground hover:bg-muted",
    dot: "bg-muted-foreground/50",
  },
};

interface SyncBadgeProps {
  status: SyncStatus;
}

export function SyncBadge({ status }: SyncBadgeProps) {
  const c = config[status];
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 px-2.5 py-0.5 text-[11px] font-medium transition-colors",
        c.className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {c.label}
    </Badge>
  );
}
