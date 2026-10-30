import type { Summary } from "@/lib/metrics/summary";
import type { TallyEvent } from "@/lib/store/events";

const MAX_VISIBLE = 8;

const SECTIONS: { title: string; key: keyof Summary["lists"] }[] = [
  { title: "PRs reviewed", key: "reviewed" },
  { title: "PRs created", key: "created" },
  { title: "PRs merged", key: "merged" },
  { title: "Tickets completed", key: "completed" },
];

function Item({ event }: { event: TallyEvent }) {
  return (
    <li className="flex flex-col">
      <a
        href={event.url}
        target="_blank"
        rel="noreferrer"
        className="font-medium underline-offset-4 hover:underline"
      >
        {event.title}
      </a>
      {event.repo ? <span className="text-sm text-ink-soft">{event.repo}</span> : null}
    </li>
  );
}

function Section({ title, events }: { title: string; events: TallyEvent[] }) {
  const hidden = events.length - MAX_VISIBLE;
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h3 className="font-semibold">{title}</h3>
      {events.length === 0 ? (
        <p className="text-ink-soft">Nothing in this period yet</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.slice(0, MAX_VISIBLE).map((event) => (
            <Item key={event.externalId} event={event} />
          ))}
        </ul>
      )}
      {hidden > 0 ? <p className="text-sm text-ink-soft">and {hidden} more</p> : null}
    </section>
  );
}

export function ItemLists({ lists }: { lists: Summary["lists"] }) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      {SECTIONS.map(({ title, key }) => (
        <Section key={key} title={title} events={lists[key]} />
      ))}
    </div>
  );
}
