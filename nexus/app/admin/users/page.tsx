"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Users, Shield, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/Admin/PageHeader";
import { StatsCard } from "@/components/Admin/StatsCard";
import { StatusBadge } from "@/components/Admin/StatusBadge";
import { api, type User } from "@/lib/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const res = await api.getUsers();
    if (res.ok) setUsers(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const adminCount = users.filter((u) => u.is_admin).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Users"
        description="View ownCloud users (managed via ownCloud)"
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
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username} className="border-b border-border/50 hover:bg-muted/20">
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Users are managed in ownCloud. Create or modify users through the ownCloud admin panel.
      </p>
    </div>
  );
}
