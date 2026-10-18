export const env = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? 10) * 1024 * 1024,
  storageDir: process.env.STORAGE_DIR ?? "./storage",
};
export const isConfigured = () => Boolean(process.env.DATABASE_URL);
