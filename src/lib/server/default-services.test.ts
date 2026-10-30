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
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("creates the data directory and a working database", () => {
    const services = createDefaultServices();

    expect(services.settings().allowList).toEqual([]);
    expect(fs.existsSync(path.join(directory, "nested", "tally.db"))).toBe(true);
  });

  it("keeps the data directory and database private to the owner", () => {
    createDefaultServices();

    const mode = (target: string) => fs.statSync(target).mode & 0o777;
    expect(mode(path.join(directory, "nested"))).toBe(0o700);
    expect(mode(path.join(directory, "nested", "tally.db"))).toBe(0o600);
  });

  it("tightens an existing data directory that is open to others", () => {
    fs.mkdirSync(path.join(directory, "nested"), { mode: 0o755 });

    createDefaultServices();

    expect(fs.statSync(path.join(directory, "nested")).mode & 0o777).toBe(0o700);
  });
});
