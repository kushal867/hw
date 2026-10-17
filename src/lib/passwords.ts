import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";

const N = 16384, R = 8, P = 1, KEYLEN = 64;
const derive = (pw: string, salt: Buffer) => new Promise<Buffer>((res, rej) =>
  scrypt(pw.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  return `scrypt$${N}$${salt.toString("base64")}$${(await derive(pw, salt)).toString("base64")}`;
}

/** Constant-time check. Always does the scrypt work, even for unknown users, so timing doesn't reveal accounts. */
export async function verifyPassword(pw: string, stored: string | null | undefined) {
  const [scheme, , saltB64, hashB64] = (stored ?? DUMMY).split("$");
  if (scheme !== "scrypt") return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await derive(pw, Buffer.from(saltB64, "base64"));
  return expected.length === actual.length && timingSafeEqual(expected, actual) && stored != null;
}
const DUMMY = `scrypt$${N}$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(KEYLEN).toString("base64")}`;
