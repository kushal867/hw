import type { Metadata } from "next";
import { env } from "@/lib/env";

export const SITE_NAME = "EduSathi";
export const DEFAULT_DESCRIPTION = "Free study groups, shared notes and exam prep for students in Nepal. Find your college, join your semester's group, and learn together.";

/** Absolute URL on the public site. */
export const abs = (path = "/") => `${env.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;

/** Search engines show ~155 characters: cut at a word boundary. */
export function trimDescription(text: string, max = 158) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

/** Dynamic social-share image (see app/og/route.tsx). */
export const ogImage = (title: string, sub = "") => abs(`/og?title=${encodeURIComponent(title.slice(0, 90))}${sub ? `&sub=${encodeURIComponent(sub.slice(0, 120))}` : ""}`);

type MetaInput = { title: string; description: string; path: string; type?: "website" | "article"; index?: boolean; publishedTime?: string; modifiedTime?: string; imageTitle?: string; imageSub?: string };

/** One place that builds canonical URL + Open Graph + Twitter card, so every public page is shared nicely. */
export function pageMeta(o: MetaInput): Metadata {
  const description = trimDescription(o.description);
  const image = ogImage(o.imageTitle ?? o.title, o.imageSub ?? "EduSathi · free study groups for students in Nepal");
  return {
    title: o.title,
    description,
    alternates: { canonical: o.path },
    robots: o.index === false ? { index: false, follow: true } : undefined,
    openGraph: {
      type: o.type ?? "website", title: o.title, description, url: abs(o.path), siteName: SITE_NAME, locale: "en_NP",
      images: [{ url: image, width: 1200, height: 630, alt: o.title }],
      ...(o.publishedTime ? { publishedTime: o.publishedTime } : {}), ...(o.modifiedTime ? { modifiedTime: o.modifiedTime } : {}),
    },
    twitter: { card: "summary_large_image", title: o.title, description, images: [image] },
  };
}
