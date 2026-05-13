"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  href?: string;
  isActive?: boolean;
  isCollapsed?: boolean;
  badge?: string | number;
  onClick?: () => void;
}

export function NavItem({
  icon,
  label,
  href,
  isActive = false,
  isCollapsed = false,
  badge,
  onClick,
}: NavItemProps) {
  const innerContent = (
    <>
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center transition-colors",
          isActive && "text-brand"
        )}
      >
        {icon}
      </span>

      {!isCollapsed && (
        <>
          <span className="truncate">{label}</span>
          {badge !== undefined && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
              {badge}
            </span>
          )}
        </>
      )}
    </>
  );

  const className = cn(
    "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    isActive
      ? "bg-brand-muted text-brand"
      : "text-sidebar-foreground/70",
    isCollapsed && "justify-center px-0"
  );

  const content = href ? (
    <Link href={href} onClick={onClick} className={className}>
      {innerContent}
    </Link>
  ) : (
    <button onClick={onClick} className={className}>
      {innerContent}
    </button>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger render={content} />
        <TooltipContent side="right" sideOffset={8}>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
