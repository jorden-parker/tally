import { PageShell } from "@/components/layout/page-shell";
import { SettingsForm } from "@/components/settings/settings-form";

export default function SettingsPage() {
  return (
    <PageShell title="Settings" description="Choose what Tally counts and how it reads your week.">
      <SettingsForm />
    </PageShell>
  );
}
