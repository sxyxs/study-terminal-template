---
title: React Server Components in one page
date: 2026-01-02
summary: Server components read data directly; client components handle interaction.
tags: [react, nextjs, demo]
---

# React Server Components in one page

- **Server component** (default): runs on the server, can query the database directly, ships no JS for itself.
- **Client component** (`"use client"` at the top): runs in the browser, can use state and event handlers.
- **Server action** (`"use server"`): a function the browser can call; this site uses them for every write.

A typical page in this project:

```tsx
export default async function ProjectsPage() {
  const projects = await getProjectsOverview(); // runs on the server
  return <ProjectList projects={projects} />;
}
```
