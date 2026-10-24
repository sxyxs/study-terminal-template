---
title: SQLite WAL mode
date: 2026-01-03
summary: Why the database runs in WAL mode and how to back it up safely.
tags: [sqlite, ops, demo]
---

# SQLite WAL mode

WAL (write-ahead logging) lets readers and a writer work at the same time, which matters when
the web server and a script open the database together.

Set on every connection in `src/db/client.ts`:

```ts
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 5000");
```

Backups: copy with `sqlite3 data/study.db ".backup backup.db"` instead of `cp`, so the
`-wal` file is folded in and the snapshot is consistent.
