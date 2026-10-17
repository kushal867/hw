import "server-only";
import { createReadStream } from "fs";
import { mkdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { env } from "@/lib/env";

/** Local-disk object storage. Buckets are sub-directories; keys are always server-chosen. */
type Bucket = "documents" | "avatars";

function resolveSafe(bucket: Bucket, key: string) {
  const base = path.resolve(env.storageDir, bucket);
  const full = path.resolve(base, key);
  if (!full.startsWith(base + path.sep)) throw new Error("Invalid storage path");
  return full;
}

export async function putFile(bucket: Bucket, key: string, data: Buffer) {
  const full = resolveSafe(bucket, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data, { flag: "wx", mode: 0o640 });
}

export async function openFile(bucket: Bucket, key: string) {
  try {
    const full = resolveSafe(bucket, key);
    const s = await stat(full);
    if (!s.isFile()) return null;
    return { size: s.size, stream: Readable.toWeb(createReadStream(full)) as unknown as ReadableStream };
  } catch { return null; }
}

export async function removeFiles(bucket: Bucket, keys: string[]) {
  await Promise.all(keys.map((k) => unlink(resolveSafe(bucket, k)).catch(() => {})));
}
