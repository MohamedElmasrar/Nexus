"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  Brain,
  LayoutDashboard,
  Users,
  FolderTree,
  FolderOpen,
  HardDrive,
  ArrowLeft,
  Loader2,
  ShieldCheck,
} from "lucide-react";

const ADMIN_NAV = [
  { icon: <LayoutDashboard size={18} />, label: "Overview", href: "/admin/dashboard" },
  { icon: <FolderOpen size={18} />, label: "Files", href: "/admin/files" },
  { icon: <Users size={18} />, label: "Users", href: "/admin/users" },
  { icon: <FolderTree size={18} />, label: "Groups", href: "/admin/groups" },
  { icon: <HardDrive size={18} />, label: "Storage", href: "/admin/drives" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, isLoggedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && (!isLoggedIn || user?.role !== "admin")) {
      router.push("/dashboard");
    }
  }, [isLoading, isLoggedIn, user, router]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!isLoggedIn || user?.role !== "admin") {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Admin Sidebar */}
      <aside className="hidden md:flex h-full w-[260px] flex-col border-r border-sidebar-border bg-sidebar">
        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="brain-glow flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <Brain size={18} strokeWidth={2.2} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-foreground">
              Nexus
            </span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <ShieldCheck size={10} />
              Admin Panel
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col space-y-1 overflow-y-auto px-3 py-4">
          <span className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Management
          </span>
          {ADMIN_NAV.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive
                    ? "bg-brand-muted text-brand"
                    : "text-sidebar-foreground/70"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center transition-colors",
                    isActive && "text-brand"
                  )}
                >
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer — back to dashboard */}
        <div className="border-t border-sidebar-border px-3 py-3">
          <Link
            href="/dashboard"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <ArrowLeft size={18} />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
