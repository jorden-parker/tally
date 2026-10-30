import Link from "next/link";
import { SettingsForm } from "@/components/settings/settings-form";

export default function SettingsPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <Link href="/" className="text-sm text-ink-soft underline underline-offset-4">
        Back to dashboard
      </Link>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsForm />
    </main>
  );
}
