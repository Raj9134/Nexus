import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="group flex min-w-0 items-center gap-3" aria-label="NEXUS home">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground shadow-[0_0_30px_color-mix(in_oklab,var(--primary)_28%,transparent)] transition-transform group-hover:scale-105">
        NX
      </span>
      {!compact ? (
        <span className="min-w-0">
          <span className="block truncate font-display text-base font-semibold tracking-normal text-foreground">
            NEXUS
          </span>
          <span className="block truncate text-xs text-muted-foreground">Complete visibility</span>
        </span>
      ) : null}
    </Link>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="truncate font-display text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({
  children,
  className,
  interactive = false,
  id,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "surface-card rounded-lg p-4",
        interactive && "transition duration-200 hover:-translate-y-0.5 hover:border-primary/60",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function MetricCard({
  icon,
  label,
  value,
  trend,
  caption,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  trend?: string;
  caption: string;
}) {
  return (
    <Card interactive className="overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-secondary text-primary">
          {icon}
        </span>
        {trend ? (
          <span className="rounded-full bg-success/10 px-2 py-1 text-xs font-medium text-success">
            {trend}
          </span>
        ) : null}
      </div>
      <p className="mt-5 text-sm text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <strong className="font-display text-3xl font-semibold tracking-normal text-foreground">
          {value}
        </strong>
        <span className="text-xs text-muted-foreground">{caption}</span>
      </div>
    </Card>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "accent";
}) {
  const tones = {
    neutral: "bg-secondary text-secondary-foreground border-border",
    success: "bg-success/10 text-success border-success/25",
    warning: "bg-warning/10 text-warning border-warning/25",
    danger: "bg-destructive/10 text-destructive border-destructive/25",
    info: "bg-info/10 text-info border-info/25",
    accent: "bg-accent/10 text-accent border-accent/25",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-md bg-subtle text-xs font-semibold text-foreground",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  // Guard against NaN/undefined reaching the style attribute on an empty
  // workspace, where the underlying counts have not loaded yet.
  const safe = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

  return (
    <div
      className={cn("h-2 overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-primary transition-all duration-500"
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("nexus-skeleton rounded-md", className)} aria-hidden="true" />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface-card flex min-h-64 flex-col items-center justify-center rounded-lg p-8 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-md bg-secondary text-primary">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this workspace area.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="surface-card rounded-lg p-8 text-center">
      <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <Button className="mt-5" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-input bg-secondary/70 px-9 text-sm text-foreground outline-none transition focus:border-primary"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </label>
  );
}

export function SelectField({
  label,
  value,
  options,
  optionLabels,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  /** Display text for each option, when the value is an id rather than text. */
  optionLabels?: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0 text-xs font-medium text-muted-foreground">
      <span className="mb-1 block">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-md border border-input bg-secondary/70 px-3 pr-8 text-sm text-foreground outline-none transition focus:border-primary"
        >
          {options.map((option, index) => (
            <option key={option} value={option}>
              {optionLabels?.[index] ?? option}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </span>
    </label>
  );
}

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/78 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <button
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="surface-card nexus-enter relative max-h-[90vh] w-full max-w-xl overflow-auto rounded-lg p-5 shadow-2xl outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 id="modal-title" className="font-display text-xl font-semibold text-foreground">
          {title}
        </h2>
        {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
        <div className="mt-5">{children}</div>
        {footer ? (
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  title,
  children,
  onClose,
  wide = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-background/72 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Close drawer"
      />
      <aside
        className={cn(
          "surface-panel nexus-enter absolute bottom-0 right-0 top-0 w-full overflow-auto p-5 shadow-2xl sm:w-[460px]",
          wide && "sm:w-[620px]",
        )}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="truncate font-display text-xl font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </aside>
    </div>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="flex gap-1 overflow-x-auto rounded-md border border-border bg-secondary/60 p-1 nexus-scrollbar"
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          role="tab"
          aria-selected={value === tab}
          className={cn(
            "shrink-0 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition",
            value === tab ? "bg-elevated text-foreground shadow-sm" : "hover:text-foreground",
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

export function StatusDot({ status }: { status: string }) {
  const tone =
    status === "Online" || status === "Success" || status === "Done"
      ? "bg-success"
      : status === "Away" || status === "Warning" || status === "At Risk"
        ? "bg-warning"
        : status === "Blocked" || status === "Overdue"
          ? "bg-destructive"
          : "bg-muted-foreground";
  return <span className={cn("inline-block h-2 w-2 rounded-full", tone)} />;
}

export function ToastStack({
  toasts,
  dismiss,
}: {
  toasts: { id: string; title: string; intent: string }[];
  dismiss: (id: string) => void;
}) {
  return (
    <div className="fixed right-4 top-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="surface-card nexus-enter flex items-center gap-3 rounded-lg p-3 shadow-xl"
        >
          <span
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-md",
              toast.intent === "success"
                ? "bg-success/10 text-success"
                : toast.intent === "warning"
                  ? "bg-warning/10 text-warning"
                  : toast.intent === "error"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-info/10 text-info",
            )}
          >
            <Check className="h-4 w-4" />
          </span>
          <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{toast.title}</p>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Dismiss toast"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function SubmitButton({
  children,
  loading,
  onClick,
  intent = "default",
}: {
  children: ReactNode;
  loading?: boolean;
  onClick?: () => void;
  intent?: "default" | "destructive";
}) {
  return (
    <Button
      variant={intent === "destructive" ? "destructive" : "default"}
      onClick={onClick}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}

export function useFormValidation(fields: Record<string, string>) {
  return useMemo(
    () =>
      Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [
          key,
          value.trim().length === 0 ? "Required" : "",
        ]),
      ),
    [fields],
  );
}
