import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dataDirectory } from "@/lib/data-directory";

function tokenPath(): string {
  return path.join(dataDirectory(), "access-token");
}

export function issueAccessToken(): string {
  const token = crypto.randomBytes(32).toString("base64url");
  fs.mkdirSync(dataDirectory(), { recursive: true, mode: 0o700 });
  fs.writeFileSync(tokenPath(), token, { mode: 0o600 });
  fs.chmodSync(tokenPath(), 0o600);
  return token;
}

export function readAccessToken(): string | null {
  try {
    return fs.readFileSync(tokenPath(), "utf8");
  } catch {
    return null;
  }
}

export function isAccessToken(candidate: string | null | undefined): boolean {
  const expected = readAccessToken();
  if (!expected || !candidate) return false;
  const given = Buffer.from(candidate);
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
}
