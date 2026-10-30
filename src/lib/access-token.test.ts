import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isAccessToken, issueAccessToken, readAccessToken } from "./access-token";

describe("access token", () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "tally-token-"));
    process.env.TALLY_DATA_DIR = path.join(directory, "nested");
  });

  afterEach(() => {
    delete process.env.TALLY_DATA_DIR;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("has no token before one is issued", () => {
    expect(readAccessToken()).toBeNull();
    expect(isAccessToken("anything")).toBe(false);
  });

  it("issues a fresh token on every call and keeps it owner-only", () => {
    const first = issueAccessToken();
    const second = issueAccessToken();

    expect(first).not.toBe(second);
    expect(readAccessToken()).toBe(second);
    expect(fs.statSync(path.join(directory, "nested", "access-token")).mode & 0o777).toBe(0o600);
  });

  it("accepts only the current token", () => {
    const token = issueAccessToken();

    expect(isAccessToken(token)).toBe(true);
    expect(isAccessToken(`${token}x`)).toBe(false);
    expect(isAccessToken("")).toBe(false);
    expect(isAccessToken(null)).toBe(false);
    expect(isAccessToken(undefined)).toBe(false);
  });
});
