"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Search,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, type ChatConversation } from "@/lib/api";

export default function ChatPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listConversations();
      if (res.ok && res.data) {
        setConversations(res.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadConversations();
    });
  }, [loadConversations]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await api.createConversation("New conversation");
      if (res.ok && res.data) {
        router.push(`/dashboard/chat/${res.data.id}`);
      }
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

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
    <div className="flex h-full overflow-hidden bg-background">
      {/* Left Sidebar: Conversations Switcher */}
      <aside className="w-72 shrink-0 border-r border-border bg-card/20 flex flex-col h-full overflow-hidden relative">
        <div className="p-4 border-b border-border">
          <Button
            onClick={handleCreate}
            disabled={creating}
            size="sm"
            className="w-full gap-2 bg-brand text-brand-foreground hover:bg-brand/90 shadow-sm cursor-pointer font-medium"
          >
            {creating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={15} />
            )}
            New Chat
          </Button>
        </div>

        {/* Scrollable Conversation List */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
              Conversations
            </div>
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-brand" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground/50 italic">
                No history.
              </div>
            ) : (
              conversations.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => router.push(`/dashboard/chat/${chat.id}`)}
                  className="group relative flex items-center justify-between p-2.5 rounded-lg border border-transparent hover:bg-muted/40 cursor-pointer transition-all duration-200"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-6">
                    <MessageSquare size={15} className="text-muted-foreground/60 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate text-foreground/90">
                        {chat.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                        {formatDate(chat.updated_at)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1.5 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                    onClick={(e) => handleDelete(chat.id, e)}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full bg-background overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-brand" />
            <h1 className="text-sm font-semibold text-foreground">AI Chat Assistant</h1>
          </div>
          <Button
            onClick={handleCreate}
            disabled={creating}
            size="sm"
            className="h-8 gap-1 bg-brand hover:bg-brand/90 text-xs cursor-pointer"
          >
            {creating ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            New Chat
          </Button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="mx-auto max-w-4xl space-y-6">
            {/* Hero Banner */}
            <div className="rounded-2xl border border-brand/20 bg-brand/5 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                  Ask Nexus AI
                  <Sparkles size={18} className="text-brand animate-pulse" />
                </h2>
                <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                  Start a conversation to query documents, extract key info, get summaries, or answer questions with context. You can attach images for multimodal indexing too.
                </p>
              </div>
              <Button
                onClick={handleCreate}
                disabled={creating}
                className="bg-brand text-brand-foreground hover:bg-brand/90 font-medium px-6 h-10 shrink-0 cursor-pointer shadow-lg hover:shadow-brand/20"
              >
                {creating ? (
                  <Loader2 size={15} className="animate-spin mr-1.5" />
                ) : (
                  <Plus size={16} className="mr-1.5" />
                )}
                Start New Chat
              </Button>
            </div>

            {/* Search bar */}
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"
                size={16}
              />
              <Input
                className="pl-9 bg-card border-border/80 focus:border-brand/40"
                placeholder="Search chat history..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Conversations list */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-brand" />
                <span className="text-xs text-muted-foreground">Loading chat history...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border border-border/40 bg-card/10 rounded-2xl text-muted-foreground">
                <MessageSquare size={36} className="opacity-20 mb-3" />
                <p className="text-xs font-medium">
                  {search
                    ? "No chats match your search query."
                    : "No chat history. Start a new conversation above!"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => router.push(`/dashboard/chat/${chat.id}`)}
                    className="group relative flex items-start gap-4 p-4 rounded-xl border border-border/60 bg-card hover:bg-muted/30 hover:border-brand/20 transition-all cursor-pointer shadow-sm hover:shadow-md duration-200"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <MessageSquare size={18} />
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <h3 className="text-sm font-semibold text-foreground group-hover:text-brand transition-colors truncate">
                        {chat.title}
                      </h3>
                      <p className="text-[11px] text-muted-foreground/75 mt-1 flex items-center gap-1.5">
                        <Clock size={11} />
                        {formatDate(chat.updated_at)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => handleDelete(chat.id, e)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
