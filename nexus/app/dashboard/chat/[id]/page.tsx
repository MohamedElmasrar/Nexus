"use client";

import React, { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { api, type ChatConversation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageBubble,
  TypingIndicator,
  type ChatMessageType,
} from "@/components/Chat/MessageBubble";
import { ChatInput } from "@/components/Chat/ChatInput";
import {
  ArrowLeft,
  Loader2,
  Brain,
  Trash2,
  Plus,
  MessageSquare,
  Pencil,
  Check,
  X,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";

const WELCOME_MESSAGE: ChatMessageType = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello! I'm Nexus AI, your document assistant. I can help you find information across your uploaded documents, summarize content, and answer questions. You can also upload images to ask questions about them directly! What would you like to know?",
  timestamp: new Date(),
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ConversationPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const conversationId = Number(resolvedParams.id);
  return <ConversationContent conversationId={conversationId} />;
}

function ConversationContent({ conversationId }: { conversationId: number }) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Conversations list (left side)
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Active conversation (main)
  const [messages, setMessages] = useState<ChatMessageType[]>([WELCOME_MESSAGE]);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [activeChat, setActiveChat] = useState<ChatConversation | null>(null);

  // Title edit state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [titleSaving, setTitleSaving] = useState(false);

  // Load conversation list
  const loadConversations = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await api.listConversations();
      if (res.ok && res.data) {
        setConversations(res.data);
      }
    } catch {
      // ignore
    } finally {
      setListLoading(false);
    }
  }, []);

  // Load active conversation messages
  const loadConversation = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    setMessages([WELCOME_MESSAGE]);
    try {
      const res = await api.getConversation(conversationId);
      if (res.ok && res.data) {
        setActiveChat(res.data);
        setTitleInput(res.data.title);
        const loadedMessages: ChatMessageType[] = res.data.messages.map((m) => ({
          id: String(m.id),
          role: m.role,
          content: m.content,
          sources: m.sources?.map((s) => ({ file_path: s.file_path, snippet: s.snippet })),
          imageUrls: m.images || undefined,
          timestamp: new Date(m.created_at),
        }));
        setMessages(loadedMessages.length > 0 ? loadedMessages : [WELCOME_MESSAGE]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadConversations();
    });
  }, [loadConversations, conversationId]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadConversation();
    });
  }, [loadConversation]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleNewChat = async () => {
    try {
      const res = await api.createConversation("New conversation");
      if (res.ok && res.data) {
        router.push(`/dashboard/chat/${res.data.id}`);
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this conversation?")) {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (id === conversationId) {
        router.push("/dashboard/chat");
      }
    }
  };

  const handleSend = useCallback(async (content: string, images?: File[], responseLength?: "short" | "medium" | "long") => {
    let imageUrls: string[] | undefined;
    let apiImages: { mime_type: string; data: string }[] | undefined;

    if (images && images.length > 0) {
      imageUrls = await Promise.all(images.map(fileToDataUrl));
      apiImages = await Promise.all(
        images.map(async (file) => {
          const dataUrl = await fileToDataUrl(file);
          const base64Data = dataUrl.split(",")[1];
          return {
            mime_type: file.type,
            data: base64Data,
          };
        })
      );
    }

    const userMessage: ChatMessageType = {
      id: `msg-${Date.now()}`,
      role: "user",
      content,
      imageUrls,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const askRes = await api.askQuestion(
        conversationId,
        content,
        apiImages,
        responseLength
      );
      if (askRes.ok && askRes.data) {
        const botMessage: ChatMessageType = {
          id: String(askRes.data.message_id),
          role: "assistant",
          content: askRes.data.answer,
          sources: askRes.data.sources,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
      }
    } catch {
      // ignore
    } finally {
      setIsTyping(false);
    }
  }, [conversationId]);

  const handleSaveTitle = async () => {
    if (!titleInput.trim() || titleInput === activeChat?.title) {
      setIsEditingTitle(false);
      return;
    }
    setTitleSaving(true);
    try {
      const res = await api.updateConversationTitle(conversationId, titleInput.trim());
      if (res.ok && res.data) {
        setActiveChat((prev) => prev ? { ...prev, title: res.data.title } : null);
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, title: res.data.title } : c))
        );
      }
    } catch {
      // ignore
    } finally {
      setTitleSaving(false);
      setIsEditingTitle(false);
    }
  };

  function formatDate(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    if (diffHours < 48) return "Yesterday";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Left Sidebar: Conversations Switcher */}
      <aside
        className={cn(
          "w-72 shrink-0 border-r border-border bg-card/20 flex flex-col h-full overflow-hidden relative transition-all duration-200",
          "hidden md:flex",
          isHistoryOpen ? "flex fixed inset-y-0 left-0 z-50 bg-background shadow-2xl animate-in slide-in-from-left duration-200" : "hidden"
        )}
      >
        <div className="p-4 border-b border-border flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Button
              onClick={() => {
                setIsHistoryOpen(false);
                router.push("/dashboard/chat");
              }}
              variant="ghost"
              size="sm"
              className="w-fit gap-1 text-muted-foreground hover:text-foreground p-0 h-auto"
            >
              <ArrowLeft size={14} />
              Back to list
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsHistoryOpen(false)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground md:hidden"
            >
              <X size={16} />
            </Button>
          </div>
          <Button
            onClick={() => {
              setIsHistoryOpen(false);
              void handleNewChat();
            }}
            size="sm"
            className="w-full gap-2 bg-brand text-brand-foreground hover:bg-brand/90 shadow-sm cursor-pointer"
          >
            <Plus size={16} />
            New Chat
          </Button>
        </div>

        {/* Scrollable Conversation List */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
              Conversations
            </div>
            {listLoading ? (
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
                  onClick={() => {
                    setIsHistoryOpen(false);
                    router.push(`/dashboard/chat/${chat.id}`);
                  }}
                  className={cn(
                    "group relative flex items-center justify-between p-2.5 rounded-lg border border-transparent hover:bg-muted/40 cursor-pointer transition-all duration-200",
                    chat.id === conversationId && "bg-brand/10 border-brand/10 text-brand hover:bg-brand/10"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-6">
                    <MessageSquare size={15} className={cn("text-muted-foreground/60 shrink-0", chat.id === conversationId && "text-brand")} />
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

      {/* Mobile Drawer Backdrop */}
      {isHistoryOpen && (
        <div
          onClick={() => setIsHistoryOpen(false)}
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Main Area: Chat Window */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        {/* Top Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard/chat")}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                title="Back to list"
              >
                <ArrowLeft size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsHistoryOpen(true)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                title="Chat History"
              >
                <History size={16} />
              </Button>
            </div>
            {isEditingTitle ? (
              <div className="flex items-center gap-2 max-w-md w-full">
                <Input
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleSaveTitle()}
                  onBlur={handleSaveTitle}
                  disabled={titleSaving}
                  autoFocus
                  className="h-8 text-sm bg-muted/40"
                />
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleSaveTitle}>
                  {titleSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} className="text-emerald-400" />}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-sm font-semibold text-foreground truncate max-w-[400px]">
                  {activeChat?.title || "Loading..."}
                </h2>
                {!loading && (
                  <button
                    onClick={() => setIsEditingTitle(true)}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    title="Edit Title"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium bg-emerald-400/5 px-2 py-0.5 rounded-full border border-emerald-400/10">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </span>
          </div>
        </header>

        {/* Message List */}
        <div className="flex-1 overflow-hidden relative">
          <ScrollArea className="h-full">
            <div ref={scrollRef} className="flex flex-col gap-6 p-6 max-w-4xl mx-auto min-h-full">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="h-7 w-7 animate-spin text-brand" />
                  <span className="text-xs text-muted-foreground">Retrieving messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center gap-3 text-center py-16">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                    <Brain size={28} />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Start the conversation</h3>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Ask Nexus AI anything about your documents. You can also attach images.
                  </p>
                </div>
              ) : (
                messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
              )}
              {isTyping && <TypingIndicator />}
            </div>
          </ScrollArea>
        </div>

        {/* Input Block */}
        <div className="border-t border-border/40 p-4 bg-background">
          <div className="max-w-4xl mx-auto w-full">
            <ChatInput onSend={handleSend} disabled={isTyping} />
          </div>
        </div>
      </div>
    </div>
  );
}
