"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { toggleSaveNote } from "@/app/actions/notes";

export function SaveNoteButton({ id, saved: initial, signedIn }: { id: string; saved: boolean; signedIn: boolean }) {
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  if (!signedIn) return <Link href={`/login?next=${encodeURIComponent(`/public-notes/${id}`)}`} className="btn-secondary"><Bookmark className="h-4 w-4" aria-hidden />Save</Link>;
  return (
    <button className={saved ? "btn-secondary !border-brand-300 !bg-brand-50 !text-brand-700" : "btn-secondary"} disabled={pending} aria-pressed={saved}
      onClick={() => start(async () => { const r = await toggleSaveNote(id, !saved); (r.ok ? toast.success : toast.error)(r.message ?? ""); if (r.ok) setSaved(!saved); })}>
      {saved ? <BookmarkCheck className="h-4 w-4" aria-hidden /> : <Bookmark className="h-4 w-4" aria-hidden />}{saved ? "Saved" : "Save"}
    </button>
  );
}
