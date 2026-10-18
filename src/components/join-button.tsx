"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { joinWithToken } from "@/app/actions/groups";

export function JoinButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button className="btn-primary w-full" disabled={pending} onClick={() => start(async () => {
      const r = await joinWithToken(token);
      (r.ok ? toast.success : toast.error)(r.message ?? "");
      if (r.redirect) router.push(r.redirect);
    })}>{pending ? "Joining…" : "Join this group"}</button>
  );
}
