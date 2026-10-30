import { describe, expect, it } from "vitest";
import type { Runner } from "@/lib/exec";
import { createShortcutGet } from "./client";

function recordingRunner(output: unknown) {
  const calls: { command: string; args: string[] }[] = [];
  const run: Runner = async (command, args) => {
    calls.push({ command, args });
    return JSON.stringify(output);
  };
  return { run, calls };
}

describe("createShortcutGet", () => {
  it("runs short api for the path and parses the JSON output", async () => {
    const { run, calls } = recordingRunner({ mention_name: "jorden" });

    const result = await createShortcutGet(run)("/api/v3/member");

    expect(result).toEqual({ mention_name: "jorden" });
    expect(calls).toEqual([{ command: "short", args: ["api", "/member"] }]);
  });

  it("passes each query parameter as a raw field, decoded", async () => {
    const { run, calls } = recordingRunner({ data: [] });

    await createShortcutGet(run)(
      "/api/v3/search/stories?query=owner%3Ajorden%20is%3Adone&page_size=25&next=abc",
    );

    expect(calls[0].args).toEqual([
      "api",
      "/search/stories",
      "-f",
      "query=owner:jorden is:done",
      "-f",
      "page_size=25",
      "-f",
      "next=abc",
    ]);
  });

  it("propagates a failing command", async () => {
    const run: Runner = async () => {
      throw new Error("short api failed");
    };

    await expect(createShortcutGet(run)("/api/v3/member")).rejects.toThrow(/short api failed/);
  });
});
