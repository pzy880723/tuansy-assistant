// Server-only helpers for the quickbuy module. Never import from client code.
import { randomBytes } from "crypto";

/** 16-char base32 slug (unambiguous chars only). */
export function newSlug(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < 16; i++) out += alphabet[bytes[i] % 32];
  return out;
}

/** 16-digit numeric order number, prefixed with yyMMdd. */
export function newOrderNo(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const prefix = `${(d.getFullYear() % 100).toString().padStart(2, "0")}${pad(
    d.getMonth() + 1,
  )}${pad(d.getDate())}`;
  const rand = randomBytes(5).readUIntBE(0, 5).toString().padStart(10, "0").slice(0, 10);
  return prefix + rand;
}

/** 6-digit numeric query code. */
export function newQueryCode(): string {
  return randomBytes(3).readUIntBE(0, 3).toString().padStart(6, "0").slice(-6);
}
