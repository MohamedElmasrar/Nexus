"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Users, Shield, Loader2, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/Admin/PageHeader";
import { StatsCard } from "@/components/Admin/StatsCard";
import { StatusBadge } from "@/components/Admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormModal } from "@/components/Admin/FormModal";
import { FormField } from "@/components/Admin/FormField";
import { ConfirmDialog } from "@/components/Admin/ConfirmDialog";
import { api, type User } from "@/lib/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Create user state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete user state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState("");
  const [deleting, setDeleting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const res = await api.getUsers();
    if (res.ok) setUsers(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleCreate = async () => {
    if (!username.trim() || !password.trim()) {
      setFormError("Username and password are required.");
      return;
    }
    setFormError("");
    setSubmitting(true);
    try {
      const res = await api.createUser({
        username: username.trim(),
        password: password.trim(),
        display_name: displayName.trim(),
        email: email.trim(),
      });
      if (res.ok) {
        setShowCreateModal(false);
        // Reset fields
        setUsername("");
        setPassword("");
        setDisplayName("");
        setEmail("");
        // Reload list
        await loadUsers();
      } else {
        const errorMsg =
          res.data && typeof res.data === "object" && "detail" in res.data
            ? String((res.data as { detail?: string }).detail || "")
            : "Failed to create user. Ensure password meets ownCloud policies.";
        setFormError(errorMsg);
      }
    } catch (e: any) {
      setFormError(e.message || "Failed to create user.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await api.deleteUser(deleteTarget);
      if (res.ok) {
        setShowDeleteDialog(false);
        setDeleteTarget("");
        await loadUsers();
      } else {
        const errorMsg =
          res.data && typeof res.data === "object" && "detail" in res.data
            ? String((res.data as { detail?: string }).detail || "")
            : "Failed to delete user.";
        alert(errorMsg);
      }
    } catch (e: any) {
      alert(e.message || "Failed to delete user.");
    } finally {
      setDeleting(false);
    }
  };

  const adminCount = users.filter((u) => u.is_admin).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <PageHeader
        title="Users"
        description="View ownCloud users (managed via ownCloud)"
        action={
          <Button
            onClick={() => setShowCreateModal(true)}
            size="sm"
            className="bg-brand text-brand-foreground hover:bg-brand/90 gap-1.5 cursor-pointer"
          >
            <Plus size={14} />
            Create User
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          label="Total Users"
          value={loading ? "—" : users.length}
          icon={<Users size={18} />}
          trend="From ownCloud"
        />
        <StatsCard
          label="Admins"
          value={loading ? "—" : adminCount}
          icon={<Shield size={18} />}
          trend="In admin group"
        />
        <StatsCard
          label="Regular Users"
          value={loading ? "—" : users.length - adminCount}
          icon={<Users size={18} />}
          trend=""
        />
      </div>

      {/* User Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            No users found
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Username
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Display Name
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Email
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Role
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Groups
                </th>
                <th className="w-20 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username} className="border-b border-border/50 hover:bg-muted/20 group">
                  <td className="px-6 py-3">
                    <span className="text-sm font-medium text-foreground">{u.username}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {u.display_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {u.email || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.is_admin ? "admin" : "user"} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.groups?.map((g) => (
                        <span
                          key={g}
                          className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={u.username === "admin"} // Protect default admin
                        className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer hover:bg-destructive/10"
                        onClick={() => {
                          setDeleteTarget(u.username);
                          setShowDeleteDialog(true);
                        }}
                        title="Delete User"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Users are synchronized with ownCloud. Actions performed here will directly update your ownCloud user directory.
      </p>

      {/* Create User Form Modal */}
      <FormModal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setFormError("");
        }}
        title="Create New User"
        description="Add a user account to ownCloud provisioning."
        onSubmit={handleCreate}
        isSubmitting={submitting}
        submitLabel="Create"
        error={formError}
      >
        <FormField label="Username">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. jdoe"
            required
            className="bg-muted/30"
          />
        </FormField>
        <FormField label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            required
            className="bg-muted/30"
          />
        </FormField>
        <FormField label="Display Name">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. John Doe"
            className="bg-muted/30"
          />
        </FormField>
        <FormField label="Email Address">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. jdoe@example.com"
            className="bg-muted/30"
          />
        </FormField>
      </FormModal>

      {/* Delete User Confirm Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        title="Delete User?"
        description={`Are you sure you want to delete user "${deleteTarget}"? This will permanently delete the ownCloud user and all their files.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteDialog(false);
          setDeleteTarget("");
        }}
      />
    </div>
  );
}
