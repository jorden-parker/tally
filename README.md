# Tally

A personal productivity dashboard that runs on your own machine. Tally counts
the pull requests you reviewed, created and merged, and the Shortcut stories you
completed, then compares each period with the one before it.

It also shows what is open right now: your open pull requests, reviews requested
from you, and stories in progress.

## Requirements

- [Node.js](https://nodejs.org) 22.22.2 or later
- [Bun](https://bun.sh)
- [GitHub CLI](https://cli.github.com), signed in with `gh auth login`
- A Shortcut account, if you want ticket counts

## Getting started

```sh
git clone https://github.com/jorden-parker/tally.git
cd tally
bun install
bun run build
bun run start
```

Tally prints a link when it starts:

```text
Open Tally at http://127.0.0.1:4488/?token=...
```

Open that link. It signs your browser in, and a new link is issued each time the
server starts.

Then open **Settings** and add the GitHub owners or repositories to count, such
as `acme` or `acme/api`. Tally only reads GitHub activity for entries on this
list, so GitHub sync stays off until you add one. If you reviewed PRs in a repo
that is not on the list, the dashboard names that repo after each sync so you
can add it.

### Shortcut

To include tickets, run `bunx short install` once, then check it with
`bun run shortcut:whoami`. Setting `SHORTCUT_API_TOKEN` in `.env.local` also
works.

## How it works

Tally syncs the last 60 days of activity through the `gh` and `short`
command-line tools, so it uses their credentials and stores no GitHub
credentials of its own. It syncs when you open the dashboard if the last sync is
more than 10 minutes old, and **Sync now** runs one on demand.

Data is kept in a SQLite database at `~/.local/share/tally/tally.db`. Set
`TALLY_DATA_DIR` to keep it somewhere else.

## Security

Tally is built for one person on one machine. It listens on `127.0.0.1` only,
rejects requests that do not use a loopback host, and requires the per-run token
for every request. The data directory, database and token file are readable only
by your account.

## Development

```sh
bun run dev        # start with hot reload on port 4488
bun run test       # run tests with coverage thresholds
bun run verify     # run tests, types, lint, fallow and a production build
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org). The
pre-commit hook runs formatting, type checks, lint, tests and
[Fallow](https://github.com/fallow-rs/fallow).
