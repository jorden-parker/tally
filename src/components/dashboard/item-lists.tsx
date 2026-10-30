import type { Summary } from "@/lib/metrics/summary";
import type { TallyEvent } from "@/lib/store/events";

const MAX_VISIBLE = 8;

const SECTIONS: { title: string; key: keyof Summary["lists"] }[] = [
  { title: "PRs reviewed", key: "reviewed" },
  { title: "PRs created", key: "created" },
  { title: "PRs merged", key: "merged" },
  { title: "Tickets completed", key: "completed" },
];

type ListedItem = Pick<TallyEvent, "externalId" | "title" | "url" | "repo">;

function Item({ item }: { item: ListedItem }) {
  return (
    <li className="flex flex-col">
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="font-medium underline-offset-4 hover:underline"
      >
        {item.title}
      </a>
      {item.repo ? <span className="text-sm text-ink-soft">{item.repo}</span> : null}
    </li>
  );
}

function Section({
  title,
  items,
  emptyText,
  maxVisible,
}: {
  title: string;
  items: ListedItem[];
  emptyText: string;
  maxVisible: number;
}) {
  const hidden = items.length - maxVisible;
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h3 className="font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-ink-soft">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.slice(0, maxVisible).map((item) => (
            <Item key={item.externalId} item={item} />
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
        <Section
          key={key}
          title={title}
          items={lists[key]}
          emptyText="Nothing in this period yet"
          maxVisible={MAX_VISIBLE}
        />
      ))}
    </div>
  );
}

export function OpenLists({ open }: { open: Summary["open"] }) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <Section
        title="Your open PRs"
        items={open.prs}
        emptyText="No open PRs"
        maxVisible={open.prs.length}
      />
      <Section
        title="Tickets assigned to you"
        items={open.tickets}
        emptyText="No tickets assigned to you"
        maxVisible={open.tickets.length}
      />
    </div>
  );
}
