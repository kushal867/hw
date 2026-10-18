/** Detect an image by its magic bytes (never by filename or client MIME type). */
export const imageKind = (b: Buffer) =>
  b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? "png"
  : b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? "jpg"
  : b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" ? "webp" : null;

export const IMAGE_MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };
