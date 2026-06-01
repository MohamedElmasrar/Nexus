"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Brain, User, FileText, ExternalLink } from "lucide-react";

export interface SourceAttribution {
  file_path: string;
  snippet?: string;
}

export interface ChatMessageType {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceAttribution[];
  imageUrls?: string[];
  timestamp: Date;
}

interface MessageBubbleProps {
  message: ChatMessageType;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Extract just the filename from a full file path */
function getFileName(filePath: string): string {
  return decodeURIComponent(filePath.split("/").filter(Boolean).pop() || filePath);
}

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "group flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-brand/15 text-brand"
        )}
      >
        {isUser ? <User size={15} /> : <Brain size={15} />}
      </div>

      {/* Bubble */}
      <div
        className={cn("flex max-w-[85%] flex-col gap-1.5", isUser && "items-end")}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "rounded-tr-md bg-brand text-brand-foreground whitespace-pre-wrap"
              : "rounded-tl-md bg-card border border-border text-card-foreground prose prose-sm prose-p:leading-relaxed prose-pre:p-0 dark:prose-invert max-w-none"
          )}
        >
          {isUser ? (
            <>
              {message.imageUrls && message.imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {message.imageUrls.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Attached ${idx + 1}`}
                      className="max-h-32 max-w-[200px] rounded-lg object-cover ring-1 ring-white/20"
                    />
                  ))}
                </div>
              )}
              {message.content && <span>{message.content}</span>}
            </>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {/* Source attributions */}
        {message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {message.sources.map((source, idx) => (
              <button
                key={`${source.file_path}-${idx}`}
                title={source.snippet || `Source: ${source.file_path}`}
                className="group/source inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-all hover:border-brand/30 hover:bg-brand/10 hover:text-brand"
              >
                <FileText size={12} className="shrink-0" />
                <span className="max-w-[160px] truncate">{getFileName(source.file_path)}</span>
                <ExternalLink
                  size={10}
                  className="shrink-0 opacity-0 transition-opacity group-hover/source:opacity-100"
                />
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span
          className={cn(
            "text-[10px] text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100",
            isUser ? "text-right" : "text-left"
          )}
        >
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

/** Typing indicator shown while AI is "thinking" */
export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
        <Brain size={15} />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3">
        <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/40" />
        <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/40" />
        <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/40" />
      </div>
    </div>
  );
}
