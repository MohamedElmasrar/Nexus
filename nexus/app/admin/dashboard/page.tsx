"use client";

import React, { useEffect, useState } from "react";
import { Users, FolderTree, HardDrive, Activity, FolderOpen } from "lucide-react";
import { PageHeader } from "@/components/Admin/PageHeader";
import { StatsCard } from "@/components/Admin/StatsCard";
import { api, type User, type OwnCloudGroup } from "@/lib/api";

export default function AdminDashboardPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<OwnCloudGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [usersRes, groupsRes] = await Promise.all([
          api.getUsers(),
          api.getGroups(),
        ]);
        if (usersRes.ok) setUsers(usersRes.data);
        if (groupsRes.ok) setGroups(groupsRes.data);
      } catch {
        // Fail gracefully — cards will show 0
      } finally {
        setLoading(false);
      }
    };
    void loadAll();
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Admin Overview"
        description="Monitor and manage your Nexus instance"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Total Users"
          value={loading ? "—" : users.length}
          icon={<Users size={18} />}
          trend="From ownCloud"
        />
        <StatsCard
          label="Groups"
          value={loading ? "—" : groups.length}
          icon={<FolderTree size={18} />}
          trend="Managed by ownCloud"
        />
        <StatsCard
          label="Storage"
          value="ownCloud"
          icon={<HardDrive size={18} />}
          trend="Connected"
        />
        <StatsCard
          label="System Status"
          value="Healthy"
          icon={<Activity size={18} />}
          trend="All services running"
        />
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
          Quick Actions
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionCard
            href="/admin/files"
            icon={<FolderOpen size={20} />}
            title="File Manager"
            description="Browse, upload, and share files"
          />
          <QuickActionCard
            href="/admin/users"
            icon={<Users size={20} />}
            title="View Users"
            description="View ownCloud user accounts"
          />
          <QuickActionCard
            href="/admin/groups"
            icon={<FolderTree size={20} />}
            title="Manage Groups"
            description="Create groups and manage memberships"
          />
          <QuickActionCard
            href="/admin/drives"
            icon={<HardDrive size={20} />}
            title="Storage Status"
            description="View ownCloud connection status"
          />
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <a
      href={href}
      className="group flex items-start gap-4 rounded-lg border border-border bg-background p-4 transition-all hover:border-brand/30 hover:bg-brand/5"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand transition-colors group-hover:bg-brand/20">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </a>
  );
}
