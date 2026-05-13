"use client";

import React, { useEffect, useState } from "react";
import { Server, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/Admin/PageHeader";
import { StatsCard } from "@/components/Admin/StatsCard";

export default function AdminDrivesPage() {
  const [status, setStatus] = useState<"loading" | "connected" | "error">("loading");
  const [owncloudUrl, setOwncloudUrl] = useState("");

  useEffect(() => {
    // Check if the backend can reach ownCloud by hitting the health endpoint
    const checkConnection = async () => {
      try {
        const res = await fetch("/api/nexus?path=/api/v1/health", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setStatus("connected");
          setOwncloudUrl(data.owncloud_url || "Configured via environment");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    };
    void checkConnection();
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Storage"
        description="ownCloud connection status"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatsCard
          label="Storage Provider"
          value="ownCloud 10"
          icon={<Server size={18} />}
          trend="WebDAV + OCS API"
        />
        <StatsCard
          label="Connection"
          value={
            status === "loading"
              ? "Checking…"
              : status === "connected"
              ? "Connected"
              : "Error"
          }
          icon={
            status === "loading" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : status === "connected" ? (
              <CheckCircle2 size={18} className="text-emerald-400" />
            ) : (
              <XCircle size={18} className="text-destructive" />
            )
          }
          trend={status === "connected" ? "All systems operational" : "Check server configuration"}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70 mb-4">
          Configuration
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-muted-foreground">Provider</span>
            <span className="font-medium text-foreground">ownCloud 10 (WebDAV)</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-muted-foreground">Authentication</span>
            <span className="font-medium text-foreground">User credentials (proxied)</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground">Management</span>
            <span className="font-medium text-foreground">OCS Provisioning API</span>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          The ownCloud connection is configured via environment variables in the server deployment.
          Each user authenticates with their own ownCloud credentials.
        </p>
      </div>
    </div>
  );
}
