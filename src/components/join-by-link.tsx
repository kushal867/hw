"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function JoinByLink() {
  const router = useRouter();
  return (
    <form className="flex gap-2" onSubmit={(e) => {
      e.preventDefault();
      const v = String(new FormData(e.currentTarget).get("link") ?? "").trim();
      const token = v.split("/join/").pop()?.split(/[?#]/)[0] ?? "";
      if (!/^[\w-]{20,100}$/.test(token)) return toast.error("That doesn't look like an invitation link.");
      router.push(`/join/${token}`);
    }}>
      <label htmlFor="link" className="sr-only">Invitation link</label>
      <input id="link" name="link" className="input" placeholder="Paste invitation link" required />
      <button className="btn-primary shrink-0">Continue</button>
    </form>
  );
}
