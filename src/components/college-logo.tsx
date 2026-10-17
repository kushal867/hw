import { env } from "@/lib/env";

/** College logo/poster, with an initials fallback so cards stay recognisable before an image is uploaded. */
export function CollegeLogo({ name, path, size = 48 }: { name: string; path?: string | null; size?: number }) {
  if (path) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`${env.supabaseUrl}/storage/v1/object/public/college-logos/${path}`} alt={`${name} logo`} width={size} height={size} loading="lazy"
      className="shrink-0 rounded-control border border-line bg-white object-contain" style={{ width: size, height: size }} />;
  }
  const initials = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "C";
  return <span aria-hidden className="grid shrink-0 place-items-center rounded-control bg-brand-100 font-bold text-brand-700" style={{ width: size, height: size, fontSize: size / 2.6 }}>{initials}</span>;
}
