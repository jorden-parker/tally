import { execFile } from "node:child_process";

export type Runner = (command: string, args: string[]) => Promise<string>;

const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

export const runCommand: Runner = (command, args) =>
  new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { maxBuffer: MAX_OUTPUT_BYTES, encoding: "utf8" },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`${command} ${args.join(" ")} failed: ${stderr || error.message}`));
          return;
        }
        resolve(stdout);
      },
    );
  });
