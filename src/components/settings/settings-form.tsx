"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { WeekStart } from "@/lib/metrics/buckets";
import type { Settings } from "@/lib/store/settings";
import { api as realApi, type TallyApi } from "../api";

type SettingsFormProps = { api?: TallyApi };

type Fields = { allowList: string; weekStart: string; timeZone: string };

const TIME_ZONES = Intl.supportedValuesOf("timeZone");

function toFields(view: Settings): Fields {
  return {
    allowList: view.allowList.join("\n"),
    weekStart: String(view.weekStart),
    timeZone: view.timeZone,
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function SettingsForm({ api = realApi }: SettingsFormProps) {
  const [loaded, setLoaded] = useState<Settings | null>(null);
  const [fields, setFields] = useState<Fields | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .fetchSettings()
      .then((view) => {
        setLoaded(view);
        setFields(toFields(view));
      })
      .catch((failure) => setError(messageOf(failure)));
  }, [api]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!fields) return;
    setError(null);
    setSaved(false);
    try {
      const view = await api.saveSettings({
        allowList: fields.allowList.split("\n"),
        weekStart: Number(fields.weekStart) as WeekStart,
        timeZone: fields.timeZone,
      });
      setLoaded(view);
      setFields(toFields(view));
      setSaved(true);
    } catch (failure) {
      setError(messageOf(failure));
    }
  }

  function change(field: keyof Fields, value: string) {
    setFields((current) => (current ? { ...current, [field]: value } : current));
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p role="alert" className="max-w-2xl -rotate-1 rounded-sm bg-sticky-bug p-4 doodle-shadow">
          {error}
        </p>
      ) : null}
      {loaded && fields ? (
        <form onSubmit={save} className="flex max-w-xl flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="allow-list" className="font-medium">
              GitHub orgs and repos
            </label>
            <p id="allow-list-hint" className="text-sm text-ink-soft">
              One per line, as an owner (acme) or a repo (acme/api).
            </p>
            <textarea
              id="allow-list"
              aria-describedby="allow-list-hint"
              value={fields.allowList}
              onChange={(event) => change("allowList", event.target.value)}
              rows={6}
              className="sketch-border bg-paper p-2 font-mono"
            />
          </div>
          <label className="flex flex-col gap-2">
            <span className="font-medium">Week starts on</span>
            <select
              value={fields.weekStart}
              onChange={(event) => change("weekStart", event.target.value)}
              className="sketch-border bg-paper p-2"
            >
              <option value="1">Monday</option>
              <option value="0">Sunday</option>
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-medium">Time zone</span>
            <input
              list="time-zones"
              value={fields.timeZone}
              onChange={(event) => change("timeZone", event.target.value)}
              className="sketch-border bg-paper p-2"
            />
            <datalist id="time-zones">
              {TIME_ZONES.map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
          </label>
          <div className="flex items-center gap-4">
            <button
              type="submit"
              className="sketch-border doodle-shadow bg-highlight px-4 py-2 font-semibold text-ink transition active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
            >
              Save settings
            </button>
            {saved ? <p>Saved. Sync from the dashboard to pull in new repos.</p> : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
