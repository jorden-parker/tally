import Link from "next/link";
import { SettingsForm } from "@/components/settings/settings-form";

export default function SettingsPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 pt-10 pb-28">
      <Link href="/" className="text-sm text-ink-soft underline underline-offset-4">
        Back to dashboard
      </Link>
      <h1 className="highlighter self-start px-1 font-hand text-5xl font-bold">Settings</h1>
      <SettingsForm />
    </main>
  );
}
