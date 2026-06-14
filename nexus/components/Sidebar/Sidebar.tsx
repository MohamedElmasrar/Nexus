"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/Providers/SidebarProvider";
import { useAuth } from "@/hooks/useAuth";
import { NavItem } from "./NavItem";
import { Separator } from "@/components/ui/separator";
import { api, type Project, type Favorite, type RecentView, type SearchResultItem } from "@/lib/api";
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
  Star,
  Clock,
  Sparkles,
  Folder,
  ChevronDown,
  ChevronRight,
  X,
  Loader2,
} from "lucide-react";

export function Sidebar() {
  const { isCollapsed, toggle } = useSidebar();
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Dynamic lists state
  const [projects, setProjects] = useState<Project[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [recentViews, setRecentViews] = useState<RecentView[]>([]);

  // Collapse states for subsections
  const [isProjectsOpen, setIsProjectsOpen] = useState(true);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(true);
  const [isRecentOpen, setIsRecentOpen] = useState(true);

  // Search state & Debounce
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      return;
    }

    Promise.resolve().then(() => {
      setShowSearchResults(true);
      setIsSearching(true);
    });

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await api.searchMyFiles(searchQuery);
        if (res.ok && res.data) {
          setSearchResults(res.data.results || []);
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Fetch lists on mount and when pathname changes
  useEffect(() => {
    if (isCollapsed) return;

    let active = true;

    const loadData = async () => {
      try {
        const [projRes, favRes, recRes] = await Promise.all([
          api.listProjects(),
          api.listFavorites(),
          api.listRecentViews(5),
        ]);

        if (active) {
          if (projRes.ok) setProjects(projRes.data || []);
          if (favRes.ok) setFavorites(favRes.data || []);
          if (recRes.ok) setRecentViews(recRes.data || []);
        }
      } catch {
        // fail silently
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [isCollapsed, pathname]);

  return (
    <aside
      className={cn(
        "group relative flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out",
        isCollapsed ? "w-[var(--sidebar-collapsed-width)]" : "w-[var(--sidebar-width)]"
      )}
    >
      {/* Brand Header */}
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

      {/* Search */}
      {!isCollapsed && (
        <div className="px-3 pt-4 pb-2 relative z-50">
          <div className="relative flex w-full items-center">
            <Search size={14} className="absolute left-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search file contents..."
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                if (!val.trim()) {
                  setSearchResults([]);
                  setIsSearching(false);
                  setShowSearchResults(false);
                }
              }}
              onFocus={() => {
                if (searchQuery.trim()) setShowSearchResults(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowSearchResults(false);
                } else if (e.key === "Enter") {
                  const val = e.currentTarget.value;
                  if (val.trim()) {
                    router.push(`/dashboard/search?q=${encodeURIComponent(val.trim())}`);
                    setShowSearchResults(false);
                  }
                }
              }}
              className="w-full rounded-lg border border-border bg-muted/50 py-2 pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors"
            />
            {searchQuery ? (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setIsSearching(false);
                  setShowSearchResults(false);
                }}
                className="absolute right-3 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded hover:bg-muted"
              >
                <X size={12} />
              </button>
            ) : (
              <kbd className="absolute right-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground pointer-events-none">
                ↵
              </kbd>
            )}

            {showSearchResults && searchQuery.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1.5 max-h-80 overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-xl animate-in fade-in slide-in-from-top-1 duration-200">
                {isSearching ? (
                  <div className="flex items-center justify-center py-4 gap-2 text-xs text-muted-foreground">
                    <Loader2 size={12} className="animate-spin text-brand" />
                    <span>Searching content...</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-4 text-xs text-muted-foreground">
                    No matching documents found
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 border-b border-border/40 mb-1">
                      AI Content Matches
                    </div>
                    {searchResults.map((r, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          router.push(`/dashboard/file-info?path=${encodeURIComponent(r.file_path)}`);
                          setSearchQuery("");
                          setShowSearchResults(false);
                        }}
                        className="w-full text-left rounded-md p-2 hover:bg-muted/60 transition-colors flex flex-col gap-0.5 group cursor-pointer"
                      >
                        <span className="text-xs font-semibold text-foreground group-hover:text-brand transition-colors truncate">
                          {r.file_name}
                        </span>
                        {r.snippet && (
                          <span className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                            ...{r.snippet}...
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Nav */}
      <nav className="flex-1 flex flex-col space-y-1 overflow-y-auto px-3 py-3 scrollbar-none">
        {/* Files Section Header */}
        <div className={cn("mb-1 mt-1", !isCollapsed && "px-1")}>
          {!isCollapsed && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
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

        {/* Collapsible Projects (Only when not collapsed) */}
        {!isCollapsed && (
          <div className="space-y-1 mt-3">
            <div className="flex w-full items-center justify-between px-1 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 hover:text-foreground transition-colors">
              <Link href="/dashboard/projects" className="hover:text-foreground transition-colors flex items-center gap-1 cursor-pointer">
                <span>Projects ({projects.length})</span>
              </Link>
              <button
                onClick={() => setIsProjectsOpen(!isProjectsOpen)}
                className="hover:text-foreground transition-colors cursor-pointer p-0.5"
              >
                {isProjectsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </button>
            </div>
            
            {isProjectsOpen && (
              <div className="space-y-0.5 pl-2 border-l border-border/40 ml-1.5 animate-in fade-in duration-200">
                {projects.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground/40 italic px-2 block py-1">No projects</span>
                ) : (
                  projects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/dashboard/projects/${p.id}`}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground/85 hover:text-foreground hover:bg-muted/40 truncate transition-all duration-150",
                        pathname === `/dashboard/projects/${p.id}` && "text-brand bg-brand/5 font-semibold"
                      )}
                    >
                      <Folder size={12} className={pathname === `/dashboard/projects/${p.id}` ? "text-brand" : "text-muted-foreground/45"} />
                      <span className="truncate">{p.name}</span>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Collapsible Favorites (Only when not collapsed) */}
        {!isCollapsed && (
          <div className="space-y-1 mt-3">
            <button
              onClick={() => setIsFavoritesOpen(!isFavoritesOpen)}
              className="flex w-full items-center justify-between px-1 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer"
            >
              <span>Favorites ({favorites.length})</span>
              {isFavoritesOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
            
            {isFavoritesOpen && (
              <div className="space-y-0.5 pl-2 border-l border-border/40 ml-1.5 animate-in fade-in duration-200">
                {favorites.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground/40 italic px-2 block py-1">No favorites</span>
                ) : (
                  favorites.map((f) => (
                    <Link
                      key={f.id}
                      href={`/dashboard/file-info?path=${encodeURIComponent(f.file_path)}`}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground/85 hover:text-foreground hover:bg-muted/40 truncate transition-all duration-150"
                    >
                      <Star size={11} fill="currentColor" className="text-yellow-400 shrink-0" />
                      <span className="truncate" title={f.file_name}>{f.file_name}</span>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Collapsible Recents (Only when not collapsed) */}
        {!isCollapsed && (
          <div className="space-y-1 mt-3">
            <button
              onClick={() => setIsRecentOpen(!isRecentOpen)}
              className="flex w-full items-center justify-between px-1 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer"
            >
              <span>Recent Views</span>
              {isRecentOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
            
            {isRecentOpen && (
              <div className="space-y-0.5 pl-2 border-l border-border/40 ml-1.5 animate-in fade-in duration-200">
                {recentViews.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground/40 italic px-2 block py-1">No recents</span>
                ) : (
                  recentViews.map((rv) => (
                    <Link
                      key={rv.id}
                      href={`/dashboard/file-info?path=${encodeURIComponent(rv.file_path)}`}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground/85 hover:text-foreground hover:bg-muted/40 truncate transition-all duration-150"
                    >
                      <Clock size={11} className="text-muted-foreground/45 shrink-0" />
                      <span className="truncate" title={rv.file_name}>{rv.file_name}</span>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <Separator className="my-4 opacity-30" />

        {/* AI Assistant Section Header */}
        <div className={cn("mb-1", !isCollapsed && "px-1")}>
          {!isCollapsed && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
              AI Assistant
            </span>
          )}
        </div>
        <NavItem
          icon={<Sparkles size={18} />}
          label="AI Chat"
          href="/dashboard/chat"
          isCollapsed={isCollapsed}
          isActive={pathname.startsWith("/dashboard/chat") && !pathname.includes("/dashboard/chat-history")}
        />
        <NavItem
          icon={<MessagesSquare size={18} />}
          label="Chat History"
          href="/dashboard/chat-history"
          isCollapsed={isCollapsed}
          isActive={pathname === "/dashboard/chat-history"}
        />

        {/* Admin Section */}
        {user?.role === "admin" && (
          <>
            <Separator className="my-4 opacity-30" />

            <div className={cn("mb-1", !isCollapsed && "px-1")}>
              {!isCollapsed && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
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

      {/* Footer */}
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
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-all duration-200 cursor-pointer",
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
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-all duration-200 cursor-pointer",
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
