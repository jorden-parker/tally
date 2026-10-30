import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultServices } from "./default-services";

describe("createDefaultServices", () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "tally-data-"));
    process.env.TALLY_DATA_DIR = path.join(directory, "nested");
  });

  afterEach(() => {
    delete process.env.TALLY_DATA_DIR;
    delete process.env.SHORTCUT_API_TOKEN;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("creates the data directory and a working database", () => {
    const services = createDefaultServices();

    expect(services.settings().allowList).toEqual([]);
    expect(fs.existsSync(path.join(directory, "nested", "tally.db"))).toBe(true);
  });

  it("enables Shortcut only when a token is set", () => {
    expect(createDefaultServices().settings().shortcutConfigured).toBe(false);

    process.env.SHORTCUT_API_TOKEN = "token";

    expect(createDefaultServices().settings().shortcutConfigured).toBe(true);
  });
});
