"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageBubble,
  TypingIndicator,
  type ChatMessageType,
} from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { Brain, PanelRightClose, PanelRightOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/Providers/SidebarProvider";
import { api } from "@/lib/api";

const WELCOME_MESSAGE: ChatMessageType = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello! I'm Nexus AI, your document assistant. I can help you find information across your uploaded documents, summarize content, and answer questions. You can also upload images to ask questions about them directly! What would you like to know?",
  timestamp: new Date(),
};

/** Convert a File to a data URL for display in message bubbles */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ChatSidebar() {
  const {
    isChatOpen,
    toggleChat,
    activeConversationId,
    setActiveConversationId,
  } = useSidebar();
  
  const [messages, setMessages] = useState<ChatMessageType[]>([WELCOME_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Resize state & handlers
  const [width, setWidth] = useState<number>(400);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        // Enforce min width of 280px and max width of 800px
        const newWidth = Math.max(280, Math.min(800, window.innerWidth - mouseMoveEvent.clientX));
        setWidth(newWidth);
      }
    },
    [isResizing]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  // Sync with SidebarContext
  useEffect(() => {
    if (activeConversationId !== undefined) {
      Promise.resolve().then(() => {
        setConversationId(activeConversationId);
      });
    }
  }, [activeConversationId]);

  // Load conversation history when ID changes
  useEffect(() => {
    if (!conversationId) {
      Promise.resolve().then(() => {
        setMessages([WELCOME_MESSAGE]);
      });
      return;
    }

    let isMounted = true;
    const loadConversation = async () => {
      try {
        setIsTyping(true);
        const res = await api.getConversation(conversationId);
        if (isMounted && res.ok && res.data) {
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
        // Fallback silently
      } finally {
        if (isMounted) setIsTyping(false);
      }
    };

    void loadConversation();

    return () => {
      isMounted = false;
    };
  }, [conversationId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = useCallback(async (content: string, images?: File[], responseLength?: "short" | "medium" | "long") => {
    // Build image data URLs for display in the message bubble
    let imageUrls: string[] | undefined;
    let apiImages: { mime_type: string; data: string }[] | undefined;

    if (images && images.length > 0) {
      imageUrls = await Promise.all(images.map(fileToDataUrl));
      
      // Convert Files to base64 payload for Gemini
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
      let currentConvId = conversationId;

      // Create a new conversation if we don't have one
      if (!currentConvId) {
        const convRes = await api.createConversation("New conversation");
        if (convRes.ok && convRes.data) {
          currentConvId = convRes.data.id;
          setConversationId(currentConvId);
          setActiveConversationId(currentConvId);
        } else {
          throw new Error("Failed to create conversation");
        }
      }

      // Ask the question via the backend, passing the message, base64 images, and selected length
      const res = await api.askQuestion(currentConvId!, content, apiImages, responseLength);

      if (res.ok && res.data) {
        const assistantMessage: ChatMessageType = {
          id: `msg-${Date.now()}-ai`,
          role: "assistant",
          content: res.data.answer,
          sources: res.data.sources?.map((s) => ({
            file_path: s.file_path,
            snippet: s.snippet,
          })),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error("Failed to get response");
      }
    } catch {
      const errorMessage: ChatMessageType = {
        id: `msg-${Date.now()}-err`,
        role: "assistant",
        content:
          "I'm sorry, I couldn't process your request right now. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  }, [conversationId, setActiveConversationId]);

  const handleNewChat = useCallback(() => {
    setConversationId(null);
    setActiveConversationId(null);
    setMessages([WELCOME_MESSAGE]);
  }, [setActiveConversationId]);

  return (
    <>
      {/* Toggle button when chat is closed */}
      {!isChatOpen && (
        <button
          onClick={toggleChat}
          className="fixed right-4 bottom-8 z-50 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-lg transition-all hover:bg-muted hover:text-foreground hover:shadow-xl"
          title="Open Nexus Chat"
        >
          <PanelRightOpen size={18} />
        </button>
      )}

      {/* Chat panel */}
      <aside
        style={{
          width: isChatOpen ? `${width}px` : "0px",
        }}
        className={cn(
          "flex h-full flex-col border-l border-border bg-background transition-all ease-in-out relative",
          isChatOpen ? "opacity-100" : "opacity-0 overflow-hidden",
          isResizing ? "transition-none" : "duration-300"
        )}
      >
        {/* Resize Handle */}
        {isChatOpen && (
          <div
            onMouseDown={startResizing}
            className={cn(
              "absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand/40 active:bg-brand/60 z-50 transition-colors",
              isResizing && "bg-brand/60"
            )}
            title="Drag to resize chat panel"
          />
        )}
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-brand/15 text-brand">
              <Sparkles size={16} />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">
                Nexus AI
              </span>
              <span className="text-[11px] text-emerald-400">Online</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewChat}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="New conversation"
            >
              New Chat
            </button>
            <button
              onClick={toggleChat}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Close chat"
            >
              <PanelRightClose size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div ref={scrollRef} className="flex flex-col gap-5 p-4">
              {/* Welcome banner */}
              <div className="mx-auto mb-2 flex max-w-[280px] flex-col items-center gap-2 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                  <Brain size={24} />
                </div>
                <p className="text-xs text-muted-foreground/60">
                  Nexus uses AI to help you find and understand your documents.
                  Ask anything about your files or attach images to ask questions.
                </p>
              </div>

              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {isTyping && <TypingIndicator />}
            </div>
          </ScrollArea>
        </div>

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={isTyping} />
      </aside>
    </>
  );
}
