"use client";

import React from "react";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  className?: string;
}

/**
 * Summary statistics card. Reusable on any page.
 *
 * @example
 * <StatsCard label="Total Users" value={42} icon={<Users />} trend="+3 this week" />
 */
export function StatsCard({ label, value, icon, trend, className }: StatsCardProps) {
  return (
    <div
      className={`group rounded-xl border border-border bg-card p-5 transition-all hover:border-brand/30 hover:shadow-md hover:shadow-brand/5 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          {label}
        </span>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand transition-colors group-hover:bg-brand/15">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">
        {value}
      </p>
      {trend && (
        <p className="mt-1 text-xs text-muted-foreground">{trend}</p>
      )}
    </div>
  );
}
