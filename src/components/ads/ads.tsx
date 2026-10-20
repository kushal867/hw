"use client";
import Script from "next/script";
import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Google AdSense, switched OFF by default. Nothing loads unless NEXT_PUBLIC_ADSENSE_CLIENT is set at build time, and even then
 * ad scripts and cookies are only loaded after the visitor accepts. Ads belong on public content pages only (never in groups/chat).
 */
const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
const SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT;
const KEY = "es_ads_consent";
const listeners = new Set<() => void>();

const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
function write(v: "yes" | "no") { try { localStorage.setItem(KEY, v); } catch { /* private mode: choice lasts for this page only */ } listeners.forEach((l) => l()); }
function subscribe(cb: () => void) { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; }
const useConsent = () => useSyncExternalStore(subscribe, read, () => null);

/** Loads the AdSense script after consent (auto ads need nothing more). */
export function AdsScript() {
  const consent = useConsent();
  if (!CLIENT || consent !== "yes") return null;
  return <Script id="adsense" async strategy="afterInteractive" crossOrigin="anonymous" src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`} />;
}

export function AdsConsentBanner() {
  const consent = useConsent();
  if (!CLIENT || consent) return null;
  return (
    <div role="dialog" aria-label="Advertising cookies" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border border-line bg-surface p-4 shadow-pop sm:bottom-5">
      <p className="text-sm leading-relaxed text-slate-700">EduSathi is free because of ads on its public pages. Ads use cookies. Do you accept advertising cookies? Your groups, files and chats never show ads and are never used for ads. <a className="font-semibold text-brand-700 underline" href="/privacy">Privacy policy</a></p>
      <div className="mt-3 flex gap-2"><button className="btn-primary !min-h-[38px]" onClick={() => write("yes")}>Accept</button><button className="btn-secondary !min-h-[38px]" onClick={() => write("no")}>No thanks</button></div>
    </div>
  );
}

/** A manual ad unit. Renders nothing without consent or without a configured slot id. */
export function AdSlot({ className = "" }: { className?: string }) {
  const consent = useConsent();
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  useEffect(() => {
    if (!CLIENT || !SLOT || consent !== "yes" || pushed.current || !ref.current) return;
    try { ((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle ||= []).push({}); pushed.current = true; } catch { /* blocked by an extension: fine */ }
  }, [consent]);
  if (!CLIENT || !SLOT || consent !== "yes") return null;
  return (
    <aside aria-label="Advertisement" className={`my-8 overflow-hidden rounded-2xl border border-line bg-white/70 p-3 text-center ${className}`}>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Advertisement</p>
      <ins ref={ref} className="adsbygoogle block" data-ad-client={CLIENT} data-ad-slot={SLOT} data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  );
}
