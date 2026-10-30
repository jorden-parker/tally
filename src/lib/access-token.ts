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

function matches(candidate: string | null | undefined, expected: string | null): boolean {
  if (!expected || !candidate) return false;
  const given = Buffer.from(candidate);
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
}

export function isAccessToken(candidate: string | null | undefined): boolean {
  return matches(candidate, readAccessToken());
}

export function sessionValue(): string | null {
  const token = readAccessToken();
  return token && crypto.createHmac("sha256", token).update("tally-session").digest("base64url");
}

export function isSessionValue(candidate: string | null | undefined): boolean {
  return matches(candidate, sessionValue());
}
