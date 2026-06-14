"use client";

import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { Settings as SettingsIcon, User, Shield, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex h-14 shrink-0 items-center border-b border-border px-6">
        <div className="flex items-center gap-2">
          <SettingsIcon size={18} className="text-brand" />
          <h1 className="text-sm font-semibold text-foreground">Settings</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="mx-auto max-w-4xl space-y-10">
          {/* Profile Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <User size={18} className="text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Profile</h2>
            </div>
            <div className="grid gap-6 rounded-xl border border-border bg-card/50 p-6 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Username</label>
                  <Input value={user?.username || ""} disabled />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Email</label>
                  <Input value={user?.email || ""} disabled />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Display Name</label>
                  <Input defaultValue={user?.display_name || ""} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Role</label>
                  <div className="flex h-9 items-center px-3 rounded-md border border-border bg-muted/30 text-sm text-muted-foreground">
                    {user?.role === "admin" ? "Administrator" : "Standard User"}
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button className="bg-brand hover:bg-brand/90">Save Changes</Button>
              </div>
            </div>
          </section>

          {/* Security Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Shield size={18} className="text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Security</h2>
            </div>
            <div className="rounded-xl border border-border bg-card/50 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
                  <p className="text-xs text-muted-foreground">Add an extra layer of security to your account.</p>
                </div>
                <Button variant="outline" size="sm">Enable</Button>
              </div>
              <div className="h-px bg-border/50" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Change Password</p>
                  <p className="text-xs text-muted-foreground">Update your ownCloud account password.</p>
                </div>
                <Button variant="outline" size="sm">Update</Button>
              </div>
            </div>
          </section>

          {/* Notifications Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <HardDrive size={18} className="text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Storage & AI</h2>
            </div>
            <div className="rounded-xl border border-border bg-card/50 p-6 shadow-sm space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Storage Usage</span>
                  <span className="font-medium text-foreground text-xs">2.4 GB of 5.0 GB used</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-brand" style={{ width: "48%" }} />
                </div>
              </div>
              <div className="h-px bg-border/50" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">AI Indexing</p>
                  <p className="text-xs text-muted-foreground">Automatically index new files for Nexus AI.</p>
                </div>
                <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-brand">
                  <span className="inline-block h-4 w-4 translate-x-6 rounded-full bg-white transition-transform" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
