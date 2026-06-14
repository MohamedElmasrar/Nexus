"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  MessagesSquare,
  Search,
  MessageSquare,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type ChatConversation } from "@/lib/api";
import { useSidebar } from "@/components/Providers/SidebarProvider";

export default function ChatHistoryPage() {
  const { openConversation } = useSidebar();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listConversations();
      if (res.ok && res.data) {
        setConversations(res.data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadConversations();
    });
  }, [loadConversations]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  };

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  function formatDate(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${Math.floor(diffHours)} hours ago`;
    if (diffHours < 48) return "Yesterday";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex h-14 shrink-0 items-center border-b border-border px-6">
        <div className="flex items-center gap-2">
          <MessagesSquare size={18} className="text-brand" />
          <h1 className="text-sm font-semibold text-foreground">Chat History</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={16}
              />
              <Input
                className="pl-9 bg-card/50"
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <MessagesSquare
                size={40}
                strokeWidth={1}
                className="mb-4 opacity-20"
              />
              <p className="text-sm">
                {search
                  ? "No conversations match your search."
                  : "No conversations yet. Start chatting with Nexus AI!"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => openConversation(chat.id)}
                  className="group flex items-center justify-between p-4 rounded-xl border border-border bg-card/40 hover:bg-card/80 transition-all cursor-pointer shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <MessageSquare size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-foreground group-hover:text-brand transition-colors truncate">
                        {chat.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(chat.updated_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={(e) => handleDelete(chat.id, e)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
