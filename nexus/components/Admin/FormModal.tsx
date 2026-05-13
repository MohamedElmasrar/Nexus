"use client";

import React from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  onSubmit: () => void | Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
  children: React.ReactNode;
  error?: string;
}

/**
 * Slide-in form panel for create/edit operations.
 *
 * Uses a right-side overlay panel for a premium feel instead of centered modals.
 *
 * @example
 * <FormModal
 *   open={showModal}
 *   onClose={() => setShowModal(false)}
 *   title="Create User"
 *   onSubmit={handleCreate}
 *   isSubmitting={saving}
 * >
 *   <FormField label="Username">
 *     <Input value={username} onChange={...} />
 *   </FormField>
 * </FormModal>
 */
export function FormModal({
  open,
  onClose,
  title,
  description,
  onSubmit,
  isSubmitting = false,
  submitLabel = "Save",
  children,
  error,
}: FormModalProps) {
  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in-0 duration-200"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md animate-in slide-in-from-right duration-300">
        <div className="flex h-full w-full flex-col border-l border-border bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              {description && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              <X size={16} />
            </Button>
          </div>

          {/* Form body */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {children}

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
                  <p className="text-sm font-medium text-destructive">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4 bg-muted/30">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-brand text-brand-foreground hover:bg-brand/90"
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {submitLabel}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
