"use client";
import { useRef, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export type ActionResult = { ok: boolean; message?: string; redirect?: string; data?: unknown };

/** Runs a server action, shows toast feedback, disables the submit button while pending. */
export function ActionForm({ action, children, className, resetOnSuccess, confirm }: {
  action: (fd: FormData) => Promise<ActionResult>; children: ReactNode; className?: string; resetOnSuccess?: boolean; confirm?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} className={className} aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget);
        start(async () => {
          try {
            const r = await action(fd);
            if (r.message) (r.ok ? toast.success : toast.error)(r.message);
            if (r.ok && resetOnSuccess) ref.current?.reset();
            if (r.redirect) router.push(r.redirect); else if (r.ok) router.refresh();
          } catch { toast.error("Something went wrong. Please try again."); }
        });
      }}>
      <fieldset disabled={pending} className="contents">{children}</fieldset>
      {pending && <span className="sr-only" role="status">Working…</span>}
    </form>
  );
}

export function SubmitButton({ children, variant = "primary", className = "" }: { children: ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost"; className?: string }) {
  return <button type="submit" className={`btn-${variant} ${className}`}>{children}</button>;
}
export const Spinner = () => <Loader2 className="h-4 w-4 animate-spin" aria-hidden />;
