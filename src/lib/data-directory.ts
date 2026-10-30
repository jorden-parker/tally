import os from "node:os";
import path from "node:path";

export function dataDirectory(): string {
  return process.env.TALLY_DATA_DIR ?? path.join(os.homedir(), ".local", "share", "tally");
}
