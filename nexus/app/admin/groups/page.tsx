"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Users, Plus, Trash2, UserPlus, UserMinus, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/Admin/PageHeader";
import { StatsCard } from "@/components/Admin/StatsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type OwnCloudGroup, type User } from "@/lib/api";

// ── Delete Modal ──────────────────────────────────────────────────────────

function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  isDeleting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  isDeleting: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl border border-border animate-in fade-in zoom-in duration-200">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Trash2 size={24} />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Delete Group</h2>
          <p className="mt-2 text-sm text-muted-foreground text-balance">
            Are you sure you want to delete <span className="font-semibold text-foreground">&ldquo;{title}&rdquo;</span>? All memberships will be removed.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={isDeleting} className="sm:flex-1">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting} className="sm:flex-1">
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<OwnCloudGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Create group
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  // Selected group details
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [addUsername, setAddUsername] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    const res = await api.getGroups();
    if (res.ok) setGroups(res.data);
    setLoading(false);
  }, []);

  const loadUsers = useCallback(async () => {
    const res = await api.getUsers();
    if (res.ok) setAllUsers(res.data);
  }, []);

  useEffect(() => {
    void loadGroups();
    void loadUsers();
  }, [loadGroups, loadUsers]);

  const loadMembers = async (groupId: string) => {
    setSelectedGroup(groupId);
    setLoadingMembers(true);
    const res = await api.getGroup(groupId);
    if (res.ok) setMembers(res.data.members || []);
    setLoadingMembers(false);
  };

  const handleCreate = async () => {
    if (!newGroupName.trim()) return;
    setCreating(true);
    const res = await api.createGroup(newGroupName.trim());
    setCreating(false);
    if (res.ok) {
      setShowCreate(false);
      setNewGroupName("");
      await loadGroups();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteGroup(deleteTarget);
      if (selectedGroup === deleteTarget) {
        setSelectedGroup(null);
        setMembers([]);
      }
      await loadGroups();
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleAddUser = async () => {
    if (!selectedGroup || !addUsername.trim()) return;
    await api.addUserToGroup(selectedGroup, addUsername.trim());
    setAddUsername("");
    await loadMembers(selectedGroup);
  };

  const handleRemoveUser = async (username: string) => {
    if (!selectedGroup) return;
    await api.removeUserFromGroup(selectedGroup, username);
    await loadMembers(selectedGroup);
  };

  return (
    <div className="space-y-8">
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={deleteTarget || ""}
        isDeleting={isDeleting}
      />
      <PageHeader
        title="Groups"
        description="Manage ownCloud groups and memberships"
        action={
          <Button
            className="bg-brand text-brand-foreground hover:bg-brand/90"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={16} className="mr-2" />
            Create Group
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatsCard
          label="Total Groups"
          value={loading ? "—" : groups.length}
          icon={<Users size={18} />}
          trend="Managed by ownCloud"
        />
      </div>

      {/* Create Group Inline */}
      {showCreate && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4">
          <Input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Group name"
            className="h-9 max-w-xs"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Button size="sm" className="h-9" onClick={handleCreate} disabled={creating}>
            {creating ? "Creating…" : "Create"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9"
            onClick={() => { setShowCreate(false); setNewGroupName(""); }}
          >
            Cancel
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Group List */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
            Groups
          </h2>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card py-10 text-center text-sm text-muted-foreground">
              No groups found
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => (
                <div
                  key={g.id}
                  onClick={() => loadMembers(g.id)}
                  className={`group flex items-center justify-between rounded-lg border bg-card p-3 cursor-pointer transition-all hover:border-brand/30 ${
                    selectedGroup === g.id ? "border-brand bg-brand/5" : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <Users size={16} />
                    </div>
                    <span className="text-sm font-medium text-foreground">{g.name}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(g.id); }}
                    className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive group-hover:opacity-100"
                    title="Delete group"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Members Panel */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
            {selectedGroup ? `Members of "${selectedGroup}"` : "Select a group"}
          </h2>

          {selectedGroup && (
            <>
              {/* Add User */}
              <div className="flex items-center gap-2">
                <select
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select user to add…</option>
                  {allUsers
                    .filter((u) => !members.includes(u.username))
                    .map((u) => (
                      <option key={u.username} value={u.username}>
                        {u.display_name || u.username}
                      </option>
                    ))}
                </select>
                <Button size="sm" className="h-9 gap-1" onClick={handleAddUser} disabled={!addUsername}>
                  <UserPlus size={14} />
                  Add
                </Button>
              </div>

              {loadingMembers ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-brand" />
                </div>
              ) : members.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card py-10 text-center text-sm text-muted-foreground">
                  No members
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((username) => (
                    <div
                      key={username}
                      className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                    >
                      <span className="text-sm font-medium text-foreground">{username}</span>
                      <button
                        onClick={() => handleRemoveUser(username)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                        title="Remove from group"
                      >
                        <UserMinus size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!selectedGroup && (
            <div className="rounded-xl border border-dashed border-border bg-card py-10 text-center text-sm text-muted-foreground">
              Click a group to view its members
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
