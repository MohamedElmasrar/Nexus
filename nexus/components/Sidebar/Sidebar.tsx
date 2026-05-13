"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/Providers/SidebarProvider";
import { useAuth } from "@/hooks/useAuth";
import { NavItem } from "./NavItem";
import { Separator } from "@/components/ui/separator";
import {
  Brain,
  FolderOpen,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Search,
  ShieldCheck,
  LogOut,
} from "lucide-react";

export function Sidebar() {
  const { isCollapsed, toggle } = useSidebar();
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside
      className={cn(
        "group relative flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out",
        isCollapsed ? "w-[var(--sidebar-collapsed-width)]" : "w-[var(--sidebar-width)]"
      )}
    >
      {/* ── Brand Header ──────────────────────────────── */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-4",
          isCollapsed && "justify-center px-2"
        )}
      >
        <div className="brain-glow flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
          <Brain size={18} strokeWidth={2.2} />
        </div>
        {!isCollapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-foreground">
              Nexus
            </span>
            <span className="text-[11px] text-muted-foreground">
              Document Intelligence
            </span>
          </div>
        )}
      </div>

      {/* ── Search ────────────────────────────────────── */}
      {!isCollapsed && (
        <div className="px-3 pt-4 pb-2">
          <div className="relative flex w-full items-center">
            <Search size={14} className="absolute left-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full rounded-lg border border-border bg-muted/50 py-2 pl-9 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = e.currentTarget.value;
                  if (val.trim()) {
                    router.push(`/dashboard?q=${encodeURIComponent(val.trim())}`);
                    e.currentTarget.value = "";
                  }
                }
              }}
            />
            <kbd className="absolute right-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground pointer-events-none">
              ↵
            </kbd>
          </div>
        </div>
      )}

      {/* ── Main Nav ──────────────────────────────────── */}
      <nav className="flex-1 flex flex-col space-y-1 overflow-y-auto px-3 py-3">
        {/* Files */}
        <div className={cn("mb-2", !isCollapsed && "px-1")}>
          {!isCollapsed && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Files
            </span>
          )}
        </div>
        <NavItem
          icon={<FolderOpen size={18} />}
          label="My Files"
          href="/dashboard"
          isCollapsed={isCollapsed}
          isActive={pathname === "/dashboard" && !pathname.includes("/dashboard/")}
        />

        <Separator className="my-4 opacity-50" />

        {/* AI Assistant */}
        <div className={cn("mb-2", !isCollapsed && "px-1")}>
          {!isCollapsed && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              AI Assistant
            </span>
          )}
        </div>
        <NavItem
          icon={<MessagesSquare size={18} />}
          label="Chat History"
          href="/dashboard/chat-history"
          isCollapsed={isCollapsed}
          isActive={pathname === "/dashboard/chat-history"}
        />

        {/* ── Admin ──────────────────────────────────────── */}
        {user?.role === "admin" && (
          <>
            <Separator className="my-4 opacity-50" />

            <div className={cn("mb-2", !isCollapsed && "px-1")}>
              {!isCollapsed && (
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Administration
                </span>
              )}
            </div>
            <NavItem
              icon={<ShieldCheck size={18} />}
              label="Admin Panel"
              href="/admin/dashboard"
              isCollapsed={isCollapsed}
              isActive={pathname.startsWith("/admin")}
            />
          </>
        )}
      </nav>

      {/* ── Footer ────────────────────────────────────── */}
      <div className="border-t border-sidebar-border px-3 py-3 space-y-1">
        <NavItem
          icon={<Settings size={18} />}
          label="Settings"
          href="/dashboard/settings"
          isActive={pathname === "/dashboard/settings"}
          isCollapsed={isCollapsed}
        />
        <button
          onClick={logout}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-all duration-200",
            "hover:bg-destructive/10",
            isCollapsed && "justify-center px-0"
          )}
        >
          <LogOut size={18} />
          {!isCollapsed && <span>Logout</span>}
        </button>
        <button
          onClick={toggle}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-all duration-200",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            isCollapsed && "justify-center px-0"
          )}
        >
          {isCollapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <>
              <PanelLeftClose size={18} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
