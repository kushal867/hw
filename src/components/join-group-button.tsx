"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { joinGroup } from "@/app/actions/groups";

export function JoinGroupButton({ groupId, label }: { groupId: string; label: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button className="btn-primary w-full sm:w-auto" disabled={pending} onClick={() => start(async () => {
      const r = await joinGroup(groupId);
      (r.ok ? toast.success : toast.error)(r.message ?? "");
      if (r.redirect) router.push(r.redirect); router.refresh();
    })}>{pending ? "Working…" : label}</button>
  );
}
