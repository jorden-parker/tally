import { describe, expect, it } from "vitest";
import { runCommand } from "./exec";

describe("runCommand", () => {
  it("resolves with standard output", async () => {
    const output = await runCommand(process.execPath, ["-e", "process.stdout.write('hello')"]);

    expect(output).toBe("hello");
  });

  it("rejects with the command and its standard error", async () => {
    const failure = runCommand(process.execPath, ["-e", "console.error('boom'); process.exit(2)"]);

    await expect(failure).rejects.toThrow(/boom/);
  });
});
