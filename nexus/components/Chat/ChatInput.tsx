"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Send, Paperclip, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_IMAGES = 4;

interface ChatInputProps {
  onSend: (message: string, images?: File[], responseLength?: "short" | "medium" | "long") => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [responseLength, setResponseLength] = useState<"short" | "medium" | "long">("medium");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate preview URLs when images change
  useEffect(() => {
    const urls = images.map((file) => URL.createObjectURL(file));
    Promise.resolve().then(() => {
      setPreviewUrls(urls);
    });
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [images]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && images.length === 0) || disabled) return;
    onSend(trimmed, images.length > 0 ? images : undefined, responseLength);
    setValue("");
    setImages([]);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, images, responseLength, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    const newFiles = Array.from(fileList).filter((f) =>
      f.type.startsWith("image/")
    );
    setImages((prev) => {
      const combined = [...prev, ...newFiles];
      return combined.slice(0, MAX_IMAGES);
    });

    // Reset so the same file can be selected again
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const canSend = (value.trim() || images.length > 0) && !disabled;

  return (
    <div className="border-t border-border bg-background/80 glass p-4">
      {/* Image previews */}
      {images.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {previewUrls.map((url, idx) => (
            <div
              key={idx}
              className="group relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-muted/30 shadow-sm transition-all hover:shadow-md"
            >
              <img
                src={url}
                alt={`Attached ${idx + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                onClick={() => removeImage(idx)}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm opacity-0 transition-opacity group-hover:opacity-100"
                title="Remove image"
              >
                <X size={10} />
              </button>
              {/* Subtle overlay gradient */}
              <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-black/5" />
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border bg-muted/10 text-muted-foreground/50 transition-all hover:border-brand/40 hover:bg-brand/5 hover:text-brand/60"
              title="Add more images"
            >
              <ImageIcon size={18} />
            </button>
          )}
        </div>
      )}

      {/* Response Length selector */}
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
          Length:
        </span>
        <div className="flex rounded-lg bg-muted/40 p-0.5 border border-border/40 glass">
          {(["short", "medium", "long"] as const).map((len) => (
            <button
              key={len}
              onClick={() => setResponseLength(len)}
              disabled={disabled}
              className={cn(
                "rounded-md px-2.5 py-0.5 text-[11px] font-medium capitalize transition-all duration-200",
                responseLength === len
                  ? "bg-brand text-brand-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              {len}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-2 rounded-xl border border-border bg-card p-2 transition-colors focus-within:border-brand/40 focus-within:ring-1 focus-within:ring-brand/20">
        {/* Attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || images.length >= MAX_IMAGES}
          className={cn(
            "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
            disabled || images.length >= MAX_IMAGES
              ? "text-muted-foreground/30 cursor-not-allowed"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          title={images.length >= MAX_IMAGES ? `Max ${MAX_IMAGES} images` : "Attach image"}
        >
          <Paperclip size={16} />
          {images.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-brand-foreground shadow-sm">
              {images.length}
            </span>
          )}
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled}
        />

        {/* Input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={images.length > 0 ? "Ask about the image(s)…" : "Ask Nexus about your documents…"}
          disabled={disabled}
          rows={1}
          className={cn(
            "max-h-[120px] min-h-[36px] flex-1 resize-none bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all",
            canSend
              ? "bg-brand text-brand-foreground hover:bg-brand/90 shadow-sm"
              : "text-muted-foreground/30 cursor-not-allowed"
          )}
        >
          <Send size={15} />
        </button>
      </div>
      <p className="mt-2 text-center text-[10px] text-muted-foreground/40">
        Press <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">Enter</kbd> to send · <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
