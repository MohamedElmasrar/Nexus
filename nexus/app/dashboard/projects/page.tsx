"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { api, type OwnCloudGroup, type Project } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Folder,
  Trash2,
  Loader2,
  Search,
  Calendar,
  HardDrive,
  X,
  PlusCircle,
  FolderOpen,
} from "lucide-react";

export default function ProjectsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isLoggedIn } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Modal states for Create Project
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groups, setGroups] = useState<OwnCloudGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Delete states
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load projects
  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listProjects();
      if (res.ok && res.data) {
        setProjects(res.data);
      } else {
        setError("Failed to load projects.");
      }
    } catch (e) {
      const err = e as Error;
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load groups for dropdown (admin only)
  const loadGroups = useCallback(async () => {
    if (user?.role !== "admin") return;
    setGroupsLoading(true);
    try {
      const res = await api.getGroups();
      if (res.ok && res.data) {
        setGroups(res.data);
        if (res.data.length > 0) {
          setSelectedGroupId(res.data[0].id);
        }
      }
    } catch {
      // ignore
    } finally {
      setGroupsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && isLoggedIn) {
      Promise.resolve().then(() => {
        void loadProjects();
      });
    }
  }, [authLoading, isLoggedIn, loadProjects]);

  useEffect(() => {
    if (showCreateModal) {
      Promise.resolve().then(() => {
        void loadGroups();
      });
    }
  }, [showCreateModal, loadGroups]);

  const handleCreateProject = async () => {
    if (!projectName.trim() || !selectedGroupId) return;
    setCreating(true);
    try {
      const res = await api.createProject({
        name: projectName.trim(),
        description: projectDescription.trim(),
        group_id: selectedGroupId,
      });
      if (res.ok) {
        setShowCreateModal(false);
        setProjectName("");
        setProjectDescription("");
        void loadProjects();
      } else {
        alert((res.data as { detail?: string })?.detail || "Failed to create project.");
      }
    } catch (e) {
      const err = e as Error;
      alert(err.message || "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    setDeleting(true);
    try {
      const res = await api.deleteProject(projectToDelete.id);
      if (res.ok) {
        setProjectToDelete(null);
        void loadProjects();
      } else {
        alert(res.data?.detail || "Failed to delete project");
      }
    } catch (e) {
      const err = e as Error;
      alert(err.message || "Failed to delete project");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const isAdmin = user?.role === "admin" || user?.is_admin;

  function formatDate(iso: string) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl border border-border animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Trash2 size={24} />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Delete Project</h2>
              <p className="mt-2 text-sm text-muted-foreground text-balance">
                Are you sure you want to delete project <span className="font-semibold text-foreground">&ldquo;{projectToDelete.name}&rdquo;</span>? Files inside ownCloud will not be deleted, but the project mapping will be removed.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setProjectToDelete(null)} disabled={deleting} className="sm:flex-1">
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteProject} disabled={deleting} className="sm:flex-1">
                {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Project Modal (Admin Only) */}
      {showCreateModal && isAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl border border-border animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <FolderOpen size={18} className="text-brand" />
                Initialize New Project
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project Name</label>
                <Input
                  autoFocus
                  placeholder="E.g., Marketing Campaign"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="bg-muted/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
                <textarea
                  placeholder="Provide a brief summary of this project..."
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className="w-full min-h-[80px] rounded-lg border border-border bg-muted/30 p-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Linked ownCloud Group</label>
                {groupsLoading ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                    <Loader2 size={13} className="animate-spin text-brand" />
                    Loading available groups...
                  </div>
                ) : groups.length === 0 ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Enter ownCloud Group ID"
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="bg-muted/30"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      No groups loaded. Please enter the group ID manually.
                    </p>
                  </div>
                ) : (
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card p-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name || g.id}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={creating}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateProject}
                disabled={!projectName.trim() || !selectedGroupId || creating}
                className="bg-brand text-brand-foreground hover:bg-brand/90 px-5"
              >
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Project
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2">
          <HardDrive size={18} className="text-brand" />
          <h1 className="text-sm font-semibold text-foreground">Projects Dashboard</h1>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setShowCreateModal(true)}
            size="sm"
            className="h-8 gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer shadow-sm shadow-brand/20 transition-all font-medium text-xs"
          >
            <PlusCircle size={14} />
            Create Project
          </Button>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Top Info Banner */}
          <div className="rounded-2xl border border-border bg-card/45 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">Group Directories</h2>
              <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                Projects map directly to ownCloud group directories. Any folder placed inside a project root is automatically synchronized and shared with group members.
              </p>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={16} />
            <Input
              className="pl-9 bg-card border-border/80 focus:border-brand/40"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Project List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
              <span className="text-xs text-muted-foreground">Retrieving projects...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <p className="text-sm">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border border-border/40 bg-card/10 rounded-2xl text-muted-foreground">
              <Folder size={40} className="opacity-20 mb-3" />
              <p className="text-xs font-medium">
                {search ? "No projects match your search query." : "No projects active. Create one above to get started!"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => router.push(`/dashboard/projects/${proj.id}`)}
                  className="group relative flex flex-col justify-between p-5 rounded-2xl border border-border/60 bg-card hover:bg-muted/30 hover:border-brand/20 transition-all cursor-pointer shadow-sm hover:shadow-md duration-200 min-h-[170px]"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                        <Folder size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-foreground group-hover:text-brand transition-colors truncate">
                          {proj.name}
                        </h3>
                        <span className="inline-block mt-0.5 px-2 py-0.5 text-[9px] font-semibold bg-muted border border-border/60 text-muted-foreground rounded-full">
                          Group: {proj.group_id}
                        </span>
                      </div>
                    </div>
                    {proj.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {proj.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-border/40 pt-3.5 mt-4 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium">
                      <Calendar size={11} />
                      {formatDate(proj.created_at)}
                    </span>
                    <span className="font-semibold text-foreground/80">
                      By {proj.created_by}
                    </span>
                  </div>

                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-3 right-3 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectToDelete(proj);
                      }}
                      title="Delete Project"
                    >
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
