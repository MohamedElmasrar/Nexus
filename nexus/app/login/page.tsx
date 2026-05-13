"use client";

import React, { useState } from "react";
import { Brain, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Please enter both username and password.");
      return;
    }

    setIsSubmitting(true);
    const success = await login(username, password);

    if (!success) {
      setError("Invalid credentials or server unreachable.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border/50 bg-card/80 glass p-8 shadow-2xl glow-brand">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-4">
            <Brain size={32} className="brain-glow" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome to Nexus
          </h1>
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Log in to access your intelligent document layer.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="username"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70"
            >
              Username
            </label>
            <Input
              id="username"
              type="text"
              placeholder="e.g. admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-background/50 focus-visible:ring-brand/50 h-11"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-background/50 focus-visible:ring-brand/50 h-11"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive mt-2 text-center">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 mt-4 bg-brand text-brand-foreground hover:bg-brand/90 font-medium transition-all"
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isSubmitting ? "Authenticating..." : "Sign In"}
          </Button>
        </form>

        <p className="mt-8 text-center text-xs text-muted-foreground/50">
          Secured by Nexus API
        </p>
      </div>
    </div>
  );
}
