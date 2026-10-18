import { MessagesSquare } from "lucide-react";

export default function ChatHome() {
  return (
    <div className="grid h-full place-items-center bg-slate-50/60 p-8 text-center">
      <div><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 ring-8 ring-brand-50/60"><MessagesSquare className="h-7 w-7" aria-hidden /></span>
        <h2 className="mt-5 text-lg font-bold">Select a conversation</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted">Pick a group chat or a direct message from the list, or start a new one with a classmate.</p></div>
    </div>
  );
}
