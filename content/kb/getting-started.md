---
title: How this knowledge base works
date: 2026-01-01
summary: Every Markdown file under content/kb/ becomes an article; subfolders become sidebar folders.
tags: [meta, demo]
---

# How this knowledge base works

Each `.md` file under `content/kb/` is one article. The URL is the file path without `.md`:

| File | URL |
|---|---|
| `content/kb/getting-started.md` | `/kb/getting-started` |
| `content/kb/notes/what-is-rsc.md` | `/kb/notes/what-is-rsc` |

## Frontmatter

```markdown
---
title: Article title
date: 2026-01-01
summary: One line shown in the list.
tags: [tag-a, tag-b]
---
```

All fields are optional. Without `title` the file name is used.

## Folder labels

Folder names are shown as-is in the sidebar. To give a folder a friendlier label, add it to
`FOLDER_LABELS` in `src/lib/kb/index.ts`.

New files show up on the next page load; no rebuild is needed in dev mode. In production
(`next start`) the pages are rendered on request, so new files also appear without a rebuild.
