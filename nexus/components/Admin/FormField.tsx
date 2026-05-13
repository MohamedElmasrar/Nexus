"use client";

import React from "react";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Labeled form field wrapper with optional error message.
 *
 * @example
 * <FormField label="Email" error={errors.email}>
 *   <Input value={email} onChange={...} />
 * </FormField>
 */
export function FormField({
  label,
  htmlFor,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70"
      >
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs font-medium text-destructive">{error}</p>
      )}
    </div>
  );
}
