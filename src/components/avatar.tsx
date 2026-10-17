export function Avatar({ name, path, size = 40 }: { name: string; path?: string | null; size?: number }) {
  if (path) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/media/avatars/${path}`} alt="" width={size} height={size} loading="lazy" className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return <span aria-hidden className="grid place-items-center rounded-full bg-brand-100 font-bold text-brand-700" style={{ width: size, height: size }}>{name.slice(0, 1).toUpperCase()}</span>;
}
