"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ProblemAlert } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
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
    <div className="flex max-w-2xl flex-col gap-6">
      {error ? <ProblemAlert messages={[error]} /> : null}
      {loaded && fields ? (
        <form onSubmit={save}>
          <Card className="gap-0 py-0">
            <CardContent className="flex flex-col gap-8 py-6">
              <div className="flex flex-col gap-2">
                <Label htmlFor="allow-list">GitHub orgs and repos</Label>
                <p id="allow-list-hint" className="text-sm text-muted-foreground">
                  One per line, as an owner (acme) or a repo (acme/api).
                </p>
                <Textarea
                  id="allow-list"
                  aria-describedby="allow-list-hint"
                  value={fields.allowList}
                  onChange={(event) => change("allowList", event.target.value)}
                  rows={6}
                  className="min-h-36 font-mono"
                />
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="week-start">Week starts on</Label>
                  <NativeSelect
                    id="week-start"
                    value={fields.weekStart}
                    onChange={(event) => change("weekStart", event.target.value)}
                    className="w-full"
                  >
                    <NativeSelectOption value="1">Monday</NativeSelectOption>
                    <NativeSelectOption value="0">Sunday</NativeSelectOption>
                  </NativeSelect>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="time-zone">Time zone</Label>
                  <Input
                    id="time-zone"
                    list="time-zones"
                    value={fields.timeZone}
                    onChange={(event) => change("timeZone", event.target.value)}
                  />
                  <datalist id="time-zones">
                    {TIME_ZONES.map((zone) => (
                      <option key={zone} value={zone} />
                    ))}
                  </datalist>
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-between gap-4 bg-muted px-6 py-3">
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {saved ? "Saved. Sync from the dashboard to pull in new repos." : ""}
              </p>
              <Button type="submit">Save settings</Button>
            </CardFooter>
          </Card>
        </form>
      ) : null}
    </div>
  );
}
