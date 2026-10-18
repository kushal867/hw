import { Fragment } from "react";

const URL_RE = /(https?:\/\/[^\s<>]+)/g;
const TRAILING = /[.,;:!?'")\]}]+$/;

/** Renders message text with safe auto-links. Pure React nodes (no innerHTML); only http(s) URLs become links. */
export function MessageText({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(URL_RE);
  return (
    <span className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${className}`}>
      {parts.map((p, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{p}</Fragment>;
        const trail = p.match(TRAILING)?.[0] ?? "";
        const url = trail ? p.slice(0, -trail.length) : p;
        let ok = false; try { const u = new URL(url); ok = u.protocol === "http:" || u.protocol === "https:"; } catch { /* not a URL */ }
        return ok
          ? <Fragment key={i}><a href={url} target="_blank" rel="noopener noreferrer nofollow ugc" className="font-medium underline underline-offset-2 hover:opacity-80">{url}</a>{trail}</Fragment>
          : <Fragment key={i}>{p}</Fragment>;
      })}
    </span>
  );
}
