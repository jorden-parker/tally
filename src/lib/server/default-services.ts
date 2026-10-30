import fs from "node:fs";
import path from "node:path";
import { dataDirectory } from "@/lib/data-directory";
import { runCommand } from "@/lib/exec";
import { createShortcutGet } from "@/lib/shortcut/client";
import { openDatabase } from "@/lib/store/database";
import { createServices, type Services } from "./services";

const SERVICES_KEY = Symbol.for("tally.services");

type GlobalWithServices = typeof globalThis & { [SERVICES_KEY]?: Services };

export function createDefaultServices(): Services {
  const directory = dataDirectory();
  fs.mkdirSync(directory, { recursive: true });
  const token = process.env.SHORTCUT_API_TOKEN;
  return createServices({
    db: openDatabase(path.join(directory, "tally.db")),
    run: runCommand,
    shortcut: token ? createShortcutGet(token) : null,
    now: () => new Date(),
  });
}

export function getServices(): Services {
  const holder = globalThis as GlobalWithServices;
  holder[SERVICES_KEY] ??= createDefaultServices();
  return holder[SERVICES_KEY];
}
