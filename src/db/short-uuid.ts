import { customType } from "drizzle-orm/pg-core";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE = BigInt(ALPHABET.length); // 57
const SHORT_LEN = 22;

const CHAR_TO_VALUE = new Map<string, bigint>();
for (let i = 0; i < ALPHABET.length; i++) {
  CHAR_TO_VALUE.set(ALPHABET[i]!, BigInt(i));
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isStandardUuid(s: string): boolean {
  return UUID_RE.test(s);
}

export function uuidToShort(uuid: string): string {
  const hex = uuid.replace(/-/g, "");
  let num = BigInt("0x" + hex);
  const chars: string[] = [];
  while (num > 0n) {
    chars.push(ALPHABET[Number(num % BASE)]!);
    num = num / BASE;
  }
  // Pad to fixed length (least-significant digit first = reversed)
  while (chars.length < SHORT_LEN) {
    chars.push(ALPHABET[0]!);
  }
  return chars.reverse().join("");
}

export function shortToUuid(short: string): string {
  let num = 0n;
  for (const ch of short) {
    const val = CHAR_TO_VALUE.get(ch);
    if (val === undefined) throw new Error(`Invalid short UUID character: ${ch}`);
    num = num * BASE + val;
  }
  const hex = num.toString(16).padStart(32, "0");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export function toStandardUuid(s: string): string {
  return isStandardUuid(s) ? s.toLowerCase() : shortToUuid(s);
}

export function toShortUuid(s: string): string {
  return isStandardUuid(s) ? uuidToShort(s) : s;
}

export const shortUuid = customType<{ data: string; driverData: string }>({
  dataType() {
    return "uuid";
  },
  fromDriver(value: string): string {
    return uuidToShort(value);
  },
  toDriver(value: string): string {
    return toStandardUuid(value);
  },
});

export const SHORT_UUID_PATTERN =
  "^([2-9A-HJ-NP-Za-km-z]{22}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$";
