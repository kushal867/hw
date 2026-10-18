"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MessageCircle } from "lucide-react";

/** Opens (or finds) a direct chat with a classmate. The server enforces: shared group, not blocked, not restricted. */
export function StartChatButton({ userId, name, variant = "secondary" }: { userId: string; name: string; variant?: "secondary" | "ghost" }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <button className={`btn-${variant} !min-h-[38px] !px-3`} disabled={busy} aria-label={`Message ${name}`} onClick={async () => {
      setBusy(true);
      try {
        const r = await fetch("/api/chat/direct", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId }) });
        const j = await r.json().catch(() => null);
        if (!r.ok) { toast.error(j?.error?.message ?? "Couldn't start the chat."); return; }
        router.push(`/chat/${j.roomId}`);
      } catch { toast.error("Network error. Please try again."); } finally { setBusy(false); }
    }}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MessageCircle className="h-4 w-4" aria-hidden />}<span className="text-sm">Message</span></button>
  );
}
