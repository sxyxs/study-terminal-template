# 个人学习终端（精简版）开发指南

> 一份从零搭建「本地运行的个人学习网站」的完整开发流程。按本文档从 M0 做到 M7，就能得到一个包含**项目进展、任务管理、知识库**的单机网站。
>
> 文中所有名称、端口、时区都是示例，用 `<尖括号>` 标出的地方需要换成你自己的值。

---

## 目录

- [0. 术语表](#0-术语表)
- [1. 产品概述](#1-产品概述)
- [2. 技术选型与理由](#2-技术选型与理由)
- [3. 架构](#3-架构)
- [4. 开发流程总览](#4-开发流程总览)
- [M0 环境准备与脚手架](#m0-环境准备与脚手架)
- [M1 数据层](#m1-数据层)
- [M2 布局、样式与导航](#m2-布局样式与导航)
- [M3 项目模块](#m3-项目模块)
- [M4 任务模块与首页仪表盘](#m4-任务模块与首页仪表盘)
- [M5 知识库与项目文档](#m5-知识库与项目文档)
- [M6 部署与运维](#m6-部署与运维)
- [M7 测试与验证](#m7-测试与验证)
- [5. 踩坑清单](#5-踩坑清单)
- [6. 扩展路线](#6-扩展路线)
- [附录 A：让 AI 编码助手按阶段实现](#附录-a让-ai-编码助手按阶段实现)

---

## 0. 术语表

| 中文 | English | 说明 |
|---|---|---|
| 服务端组件 | React Server Component (RSC) | 在服务器上执行、直接读数据库并输出 HTML 的组件，默认类型 |
| 客户端组件 | Client Component | 文件顶部写 `"use client"`，可以用 state / 事件，运行在浏览器 |
| 服务端动作 | Server Action | 文件顶部写 `"use server"` 的函数，浏览器可以直接调用，用于所有写操作 |
| 路由处理器 | Route Handler | `app/**/route.ts`，提供普通 HTTP 接口，给 curl / 监控这类外部调用者用 |
| 迁移 | Migration | 由 schema 生成的 SQL 变更文件，按顺序应用到数据库 |
| 预写日志模式 | WAL (Write-Ahead Logging) | SQLite 的并发友好模式，读写互不阻塞 |
| 里程碑 / 任务 | Milestone / Task | 项目下的一条可追踪工作，状态 todo → doing → done |
| 零散待办 | Todo | 不计入项目进度的小事，只有完成/未完成两态 |
| 用户级服务 | systemd --user | 不需要 root 的常驻服务管理方式 |
| 驻留 | Linger | 让用户级服务在退出登录后继续运行的系统设置 |
| 前置信息 | Frontmatter | Markdown 文件开头 `---` 包围的元数据块 |

---

## 1. 产品概述

### 1.1 一句话

一个跑在自己电脑 / 服务器上的 Next.js 网站，单个 SQLite 文件存全部数据，帮你**一页看清每个项目卡在哪、手上有哪些任务，并把学习笔记沉淀成知识库**。

### 1.2 功能清单

| 模块 | 路由 | 核心能力 |
|---|---|---|
| 首页仪表盘 | `/` | 统计卡（进行中 / 待办 / 本周完成 / 零散待办）、所有活跃项目的任务列表 |
| 项目 | `/projects`、`/projects/[id]` | 项目增删改、状态（进行中/暂停/完成/归档）、排序、进度条（由里程碑实时计算）、任务三态、Markdown 日志时间线、项目文档列表 |
| 任务 | `/todos` | 按项目分组：每个项目的任务 + 零散待办；未归属项目的待办单独一组 |
| 知识库 | `/kb`、`/kb/[...slug]` | 读取 `content/kb/**/*.md`，子目录即分组，新增文件刷新即上线 |
| 项目文档 | `/projects/[id]/docs/[slug]` | 读取 `content/projects/<项目slug>/*.md` |
| 接口 | `/api/health` | 健康检查 |

### 1.3 明确不做

- 登录与多用户（安全边界靠「只监听本机 + SSH 隧道」或受信内网）
- 公网暴露

---

## 2. 技术选型与理由

| 决策 | 选择 | 理由 |
|---|---|---|
| 框架 | Next.js 16 App Router + TypeScript | 单人项目前后端同仓库；Server Actions 省掉手写 API 层 |
| 数据库 | SQLite 单文件（WAL） | 零运维、备份就是复制一个文件；单用户并发足够 |
| ORM | Drizzle ORM + better-sqlite3 | 纯 TS，无需下载查询引擎二进制；同步 API 与 SQLite 天然匹配 |
| 样式 | Tailwind CSS v4 + 少量全局类 | 无构建配置；`.btn .card .input .chip` 封装常用控件，避免 JSX 冗长 |
| Markdown | react-markdown + remark-gfm | 日志与知识库统一渲染，支持表格和代码块 |
| 写操作 | 全部走 Server Actions | 自动序列化，无需 fetch；单用户无需鉴权 |
| 知识库存储 | 直接读 Markdown 文件，不进数据库 | 可以用任意编辑器写、用 git 管理；刷新即生效 |
| 进程守护 | systemd --user | 系统自带、journald 日志、崩溃自动重启、开机自启 |
| 定时备份 | 系统 crontab + `sqlite3 .backup` | WAL 模式下也是一致快照，无需停服务 |
| 渲染策略 | 全部动态渲染，不加缓存层 | 数据随时在变；每次请求直接查 SQLite 足够快 |
| 日期存储 | `YYYY-MM-DD` 文本，按配置时区计算「今天」 | 避免 `toISOString()` 的 UTC 日期偏移 |
| E2E 测试 | playwright-core + 本机 Chrome | 不需要下载浏览器二进制 |

---

## 3. 架构

### 3.1 进程与数据流

```
浏览器 ──(ssh -L 3210:127.0.0.1:3210 或内网)──▶ next-server :3210  (systemd --user)
                                                   │
                         ┌─────────────────────────┼──────────────────────────┐
                         ▼                         ▼                          ▼
                  页面 (RSC 读库)          Server Actions (写库)        /api/health
                         │                         │
                         ├──────────▶ src/db/client.ts (better-sqlite3, WAL) ─▶ data/app.db
                         │
                         └──────────▶ src/lib/kb (读 content/**/*.md)

crontab ── 03:00 ──▶ sqlite3 .backup ──▶ data/backups/
```

只有**一个进程**：没有队列、没有 Redis、没有独立 worker。

### 3.2 目录结构

```
<app-dir>/
├── src/
│   ├── app/                              路由（App Router）
│   │   ├── layout.tsx                    左侧栏 + 主区域
│   │   ├── globals.css                   主题变量 + 全局控件类
│   │   ├── icon.svg                      favicon（App Router 自动注入）
│   │   ├── page.tsx                      首页仪表盘
│   │   ├── todos/page.tsx
│   │   ├── projects/page.tsx
│   │   ├── projects/[id]/page.tsx
│   │   ├── projects/[id]/docs/[slug]/page.tsx
│   │   ├── kb/page.tsx
│   │   ├── kb/[...slug]/page.tsx
│   │   └── api/health/route.ts
│   ├── actions/                          "use server"，所有写操作
│   │   ├── _util.ts  projects.ts  todos.ts
│   ├── db/
│   │   ├── schema.ts                     唯一的数据模型来源
│   │   ├── client.ts                     连接单例 + PRAGMA
│   │   └── queries/                      只读查询：projects todos
│   ├── lib/
│   │   ├── env.ts  dates.ts
│   │   └── kb/index.ts
│   └── components/                       ui.tsx（无状态通用件）+ 交互组件
├── content/
│   ├── kb/**/*.md                        知识库文章
│   └── projects/<project-slug>/*.md      项目文档
├── public/                               静态文件（生产模式下需重新 build 才生效）
├── scripts/                              migrate seed e2e
├── drizzle/                              生成的迁移 SQL（提交进仓库）
├── deploy/                               systemd unit、crontab 模板
└── data/                                 app.db、backups/（gitignore）
```

### 3.3 三种入口的分工（最重要的约定）

| 入口 | 何时用 | 位置 | 规则 |
|---|---|---|---|
| 页面（服务端组件） | 读数据并渲染 | `src/app/**/page.tsx` 调 `src/db/queries/*` 或 `src/lib/kb` | 不写库 |
| Server Action | 浏览器里的任何写操作 | `src/actions/*.ts` | 校验输入 → 写库 → `bump()`；返回值必须可序列化 |
| Route Handler | 外部程序调用 | `src/app/api/**/route.ts` | 目前只有健康检查；以后加外部接口时要校验 token |

补充规则：

- 组件不直接 import `db`。
- 查询函数第一行 `await connection()`，声明依赖本次请求，Next 不会预渲染或缓存它。

### 3.4 渲染与刷新

- 不开启任何缓存特性。所有页面是动态的。
- Action 结束调用 `revalidatePath("/", "layout")`，当前页面随响应重新渲染。
- 客户端组件用 `useTransition` 包 Action 调用，`pending` 期间禁用按钮防重复提交；需要展示返回结果的表单用 `useActionState`。

### 3.5 时间与时区

- 「日期」字段：`YYYY-MM-DD` 文本（本地日历日）。
- 「时刻」字段：应用写入的 ISO 字符串，或 SQLite 默认值 `CURRENT_TIMESTAMP`（UTC，格式 `YYYY-MM-DD HH:MM:SS`）。**这两种格式不能直接做字符串比较**（见踩坑清单）。
- `today()` 用 `Intl.DateTimeFormat("sv-SE", { timeZone })` 得到 `YYYY-MM-DD`。
- 时区需要在三处保持一致：`src/lib/env.ts`、systemd unit 的 `TZ=`、crontab 的执行时刻。

---

## 4. 开发流程总览

每个阶段都有**验收标准**，验收不过不进入下一阶段。

| 阶段 | 内容 | 依赖 | 验收 |
|---|---|---|---|
| M0 | 环境、脚手架、配置 | — | `better-sqlite3` 能打开内存库；`npm run dev` 出默认页 |
| M1 | schema、连接、迁移、种子 | M0 | `npm run migrate` 打印全部表名且 `journal_mode=wal` |
| M2 | 全局样式、布局、侧边栏 | M1 | 各路由占位页可访问，深浅色都正常 |
| M3 | 项目 + 里程碑 + 日志 | M2 | 新建项目 → 加任务 → 切 doing/done → 进度条数字正确 |
| M4 | 任务页 + 首页仪表盘 | M3 | 统计卡数字与 SQL 抽查一致 |
| M5 | 知识库与项目文档 | M2 | 新增 `.md` 刷新即出现；`../` 路径返回 404 |
| M6 | systemd、备份、运维 | M3–M5 | 服务重启后自动迁移；备份文件生成 |
| M7 | 静态检查、HTTP 巡检、E2E | 全部 | typecheck/lint 零错误；E2E 全部步骤通过、无浏览器报错 |

---

## M0 环境准备与脚手架

### M0.1 环境要求

| 项 | 要求 | 检查命令 |
|---|---|---|
| OS | Linux / macOS（Windows 用 WSL2） | `uname -a` |
| Node | ≥ 20.9（Next.js 16 要求） | `node -v` |
| sqlite3 CLI | 备份与手工查询用 | `sqlite3 --version` |
| 端口 | 选一个空闲端口，本文用 `3210` | `ss -ltnp \| grep 3210` |
| 时区 | 记下系统时区 | `timedatectl` 或 `date +%Z` |
| 编译器 | 若 Node 20 + gcc < 10，better-sqlite3 必须用有预编译包的 11.x | `gcc --version` |
| Chrome（可选） | E2E 测试 | `which google-chrome` |

### M0.2 创建项目

```bash
npx create-next-app@latest study-hub --ts --app --tailwind --eslint --src-dir --import-alias "@/*" --use-npm
cd study-hub
npm install drizzle-orm better-sqlite3@^11.10.0 react-markdown remark-gfm
npm install -D drizzle-kit tsx @types/better-sqlite3 playwright-core
node -e "const D=require('better-sqlite3'); console.log(new D(':memory:').prepare('select sqlite_version() v').get())"
```

> **Next.js 16 与旧版本差异很大**。开工前先读 `node_modules/next/dist/docs/` 里的指南。本项目用到的差异：`params` / `searchParams` 是 Promise；用 `connection()` 强制动态；`next build` 不再自动 lint；Turbopack 默认启用。

### M0.3 `package.json` scripts

```json
{
  "scripts": {
    "dev": "next dev -H 127.0.0.1 -p 3210",
    "build": "next build",
    "start": "next start -H 127.0.0.1 -p 3210",
    "prestart": "npm run migrate",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "migrate": "tsx scripts/migrate.ts",
    "seed": "tsx scripts/seed.ts",
    "db:generate": "drizzle-kit generate",
    "db:studio": "drizzle-kit studio"
  }
}
```

- `prestart` 让每次启动前自动应用迁移。
- 只想在受信内网访问时，把 `start` 的 `-H 127.0.0.1` 改成 `-H 0.0.0.0`（没有登录，**不要开到公网**）。

### M0.4 配置文件

`next.config.ts`：

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native module: keep it out of the server bundle.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
```

`drizzle.config.ts`：

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DB_PATH ?? "./data/app.db" },
});
```

`.env.local`（不入库）：

```bash
DB_PATH=./data/app.db
TZ=<Your/Timezone>            # e.g. Asia/Shanghai
```

`.gitignore` 追加：

```
/data/
.env.local
```

### M0.5 `src/lib/env.ts`

```ts
import path from "node:path";

function str(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v && v.length > 0) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing env var ${name}`);
}

/** Change once to your timezone. Keep it in sync with the systemd unit TZ= and crontab times. */
export const APP_TIMEZONE = "Asia/Shanghai";

export const env = {
  get dbPath(): string {
    return path.resolve(process.cwd(), str("DB_PATH", "./data/app.db"));
  },
  timeZone: APP_TIMEZONE,
};
```

> 时区写成常量而不是环境变量：`dates.ts` 也会被客户端组件引用，而普通环境变量在浏览器端读不到，会导致服务端/客户端算出的日期不一致。
> 这个模块不要 import `node:os` 之类的 Node 专有模块，否则客户端打包会失败。

### M0.6 `src/lib/dates.ts`

```ts
import { env } from "./env";

const fmt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: env.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Local calendar date (YYYY-MM-DD) in the configured timezone. */
export function toLocalDate(d: Date = new Date()): string {
  return fmt.format(d);
}

export function today(): string {
  return toLocalDate();
}

export function isValidDate(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

/** Add n days to a YYYY-MM-DD string (UTC arithmetic, safe for date-only values). */
export function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday-start week range containing `date`. */
export function weekRange(date: string): { start: string; end: string } {
  const d = new Date(date + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  const start = addDays(date, -dow);
  return { start, end: addDays(start, 6) };
}

export function weekdayShort(date: string): string {
  return ["日", "一", "二", "三", "四", "五", "六"][new Date(date + "T00:00:00Z").getUTCDay()];
}

/** Format either an ISO string or SQLite's "YYYY-MM-DD HH:MM:SS" (UTC) for display. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso.includes("T") || iso.endsWith("Z") ? iso : iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: env.timeZone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
```

**M0 验收**：`npm run dev` 能打开 `http://127.0.0.1:3210`；上面的 `node -e` 能打印 SQLite 版本。

---

## M1 数据层

### M1.1 约定

| 约定 | 说明 |
|---|---|
| 主键 | `id INTEGER PRIMARY KEY AUTOINCREMENT` |
| 布尔 | INTEGER 0/1，Drizzle `mode: "boolean"` |
| 外键 | 从属数据 cascade（里程碑、日志）；弱引用 set null（待办→项目） |
| 命名 | 表与列 snake_case，TS 属性 camelCase |
| 进度 | **不落库**，由里程碑实时计算 |

### M1.2 `src/db/schema.ts`

```ts
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const now = sql`(CURRENT_TIMESTAMP)`;

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  status: text("status", { enum: ["active", "paused", "done", "archived"] }).notNull().default("active"),
  color: text("color"),
  targetDate: text("target_date"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
});

export const MILESTONE_STATUSES = ["todo", "doing", "done"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const milestones = sqliteTable(
  "milestones",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    dueDate: text("due_date"),
    /** todo → doing → done. `done` is kept in sync for the progress counters. */
    status: text("status", { enum: MILESTONE_STATUSES }).notNull().default("todo"),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    doneAt: text("done_at"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("milestones_project").on(t.projectId)],
);

export const projectLogs = sqliteTable(
  "project_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    title: text("title"),
    bodyMd: text("body_md").notNull(),
    kind: text("kind", { enum: ["note", "experiment", "milestone", "blocker"] }).notNull().default("note"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("project_logs_project_date").on(t.projectId, t.date)],
);

export const todos = sqliteTable(
  "todos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Day the todo was added; shown as context only. */
    date: text("date").notNull(),
    title: text("title").notNull(),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    doneAt: text("done_at"),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
    priority: integer("priority").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("todos_date_done").on(t.date, t.done), index("todos_project").on(t.projectId)],
);

export type Project = typeof projects.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;
export type ProjectLog = typeof projectLogs.$inferSelect;
export type Todo = typeof todos.$inferSelect;
```

### M1.3 `src/db/client.ts`

```ts
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

declare global {
  var __appDb: { sqlite: Database.Database; db: DB } | undefined;
}

function open() {
  const file = env.dbPath;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

// Reuse the connection across dev hot reloads.
const conn = globalThis.__appDb ?? open();
if (process.env.NODE_ENV !== "production") globalThis.__appDb = conn;

export const db: DB = conn.db;
export const sqlite = conn.sqlite;
```

### M1.4 迁移与种子

`scripts/migrate.ts`：

```ts
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { db, sqlite } from "../src/db/client";

migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
const mode = sqlite.pragma("journal_mode", { simple: true });
const tables = sqlite
  .prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%' and name not like '__drizzle%' order by name")
  .all()
  .map((r) => (r as { name: string }).name);
console.log(`migrated ok (journal_mode=${mode}) tables: ${tables.join(", ")}`);
sqlite.close();
```

`scripts/seed.ts` 的要求（按你的实际情况填数据）：

- **幂等**：项目按 `slug` 判断，已存在就跳过。
- 写入几个示例项目，每个带几个里程碑，例如：

```ts
const PROJECTS = [
  { name: "<项目 A>", slug: "project-a", description: "<一句话描述>", status: "active", color: "#6366f1", milestones: ["<任务 1>", "<任务 2>"] },
  { name: "<项目 B>", slug: "project-b", description: "<一句话描述>", status: "paused", color: "#0ea5e9", milestones: [] },
] as const;
```

- 不使用顶层 `await`（tsx 默认按 CJS 编译脚本），需要异步时包成 `async function main()`。

标准迁移流程：

```bash
# 1. edit src/db/schema.ts
npm run db:generate   # writes drizzle/000N_xxx.sql + meta/
npm run migrate       # apply locally
# 2. commit schema.ts and drizzle/
```

- 不要手改 `drizzle/meta/`。
- SQLite 不支持大部分 `ALTER COLUMN`；改列约束时 drizzle-kit 会生成「建新表 → 拷数据 → 删旧表」，先在备份上试。
- 新增有默认值的列时，若需要回填旧数据（如由 `done=1` 回填 `status='done'`），在生成的 SQL 末尾手工加一句 `UPDATE`。

**M1 验收**：`npm run migrate` 输出 `migrated ok (journal_mode=wal) tables: milestones, project_logs, projects, todos`；`npm run seed` 连跑两次，第二次不新增。

---

## M2 布局、样式与导航

### M2.1 `globals.css`：主题变量 + 全局类

```css
@import "tailwindcss";

:root {
  --bg: #f6f7f9; --panel: #ffffff; --panel-2: #f0f2f5; --border: #e3e6eb;
  --fg: #16181d; --muted: #6b7280; --accent: #4f46e5; --accent-fg: #ffffff;
  --ok: #10b981; --warn: #f59e0b; --danger: #ef4444;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1115; --panel: #171a21; --panel-2: #1f232c; --border: #2a2f3a;
    --fg: #e6e8ee; --muted: #8b93a5; --accent: #818cf8; --accent-fg: #0f1115;
  }
}

/* Expose tokens as Tailwind utilities: bg-panel, text-muted, border-accent ... */
@theme inline {
  --color-bg: var(--bg); --color-panel: var(--panel); --color-panel-2: var(--panel-2);
  --color-border: var(--border); --color-fg: var(--fg); --color-muted: var(--muted);
  --color-accent: var(--accent); --color-accent-fg: var(--accent-fg);
  --color-ok: var(--ok); --color-warn: var(--warn); --color-danger: var(--danger);
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif;
  --font-mono: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
}

html, body { background: var(--bg); color: var(--fg); font-family: var(--font-sans); }
* { border-color: var(--border); }
input, textarea, select { background: var(--panel); color: var(--fg); }

.card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; }

.btn {
  display: inline-flex; align-items: center; gap: 0.375rem;
  border: 1px solid var(--border); background: var(--panel); color: var(--fg);
  border-radius: 8px; padding: 0.375rem 0.75rem; font-size: 0.8125rem; line-height: 1.25rem;
  cursor: pointer; white-space: nowrap;
}
.btn:hover { background: var(--panel-2); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
.btn-sm { padding: 0.125rem 0.5rem; font-size: 0.75rem; }
.btn-ghost { border-color: transparent; background: transparent; }
.btn-danger { color: var(--danger); }

.input {
  border: 1px solid var(--border); border-radius: 8px; padding: 0.375rem 0.625rem;
  font-size: 0.875rem; line-height: 1.25rem; width: 100%;
}
.input:focus { outline: 2px solid color-mix(in srgb, var(--accent) 40%, transparent); border-color: var(--accent); }

.chip {
  display: inline-flex; align-items: center; gap: 0.25rem; border-radius: 999px;
  padding: 0.0625rem 0.5rem; font-size: 0.6875rem; line-height: 1rem;
  border: 1px solid var(--border); background: var(--panel-2); color: var(--muted); white-space: nowrap;
}

.nav-link { display: flex; align-items: center; gap: 0.625rem; padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.875rem; color: var(--muted); }
.nav-link:hover, .nav-link[data-active="true"] { background: var(--panel-2); color: var(--fg); }
.nav-link[data-active="true"] { font-weight: 600; }

/* Markdown (logs, docs) */
.prose-md { font-size: 0.875rem; line-height: 1.65; }
.prose-md h1, .prose-md h2, .prose-md h3 { font-weight: 600; margin: 0.75em 0 0.35em; }
.prose-md p { margin: 0.4em 0; }
.prose-md ul, .prose-md ol { padding-left: 1.4em; margin: 0.4em 0; }
.prose-md ul { list-style: disc; } .prose-md ol { list-style: decimal; }
.prose-md code { font-family: var(--font-mono); font-size: 0.85em; background: var(--panel-2); padding: 0.1em 0.35em; border-radius: 4px; }
.prose-md pre { background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem; overflow-x: auto; }
.prose-md pre code { background: transparent; padding: 0; }
.prose-md table { border-collapse: collapse; font-size: 0.85em; }
.prose-md th, .prose-md td { border: 1px solid var(--border); padding: 0.25em 0.6em; }
.prose-md blockquote { border-left: 3px solid var(--border); padding-left: 0.75em; color: var(--muted); }
.prose-md a { color: var(--accent); text-decoration: underline; }

/* Long-form articles (knowledge base) */
.prose-md.prose-article { font-size: 0.9375rem; line-height: 1.75; }
.prose-md.prose-article h2 { font-size: 1.2em; margin: 1.6em 0 0.5em; padding-bottom: 0.25em; border-bottom: 1px solid var(--border); }
.prose-md.prose-article table { display: block; overflow-x: auto; width: 100%; }
```

### M2.2 通用组件 `src/components/ui.tsx`

无状态、可在服务端组件中使用：

| 组件 | 作用 |
|---|---|
| `PageHeader({ title, subtitle, actions })` | 页面标题栏 |
| `Card({ title, actions, children })` | 带标题的卡片 |
| `ProgressBar({ value, total, color })` | 进度条 + `3/5 · 60%` |
| `Dot({ color })` | 项目色点 |
| `Empty({ children })` | 虚线框空状态 |
| `StatusBadge({ status })` | 项目状态与任务状态的中文标签与颜色映射 |
| `BackLink({ href, children })` | 返回链接 |
| `MILESTONE_STATUS_LABEL` | `{ todo: "待办", doing: "进行中", done: "完成" }` |

`src/components/Markdown.tsx`：

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`prose-md ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
```

### M2.3 布局 `src/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { SidebarNav } from "@/components/SidebarNav";

export const metadata: Metadata = {
  title: { default: "Study Hub", template: "%s · Study Hub" },
  description: "个人学习终端：项目进展 · 任务 · 知识库",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <aside className="hidden w-56 shrink-0 border-r bg-panel md:sticky md:top-0 md:flex md:h-screen md:flex-col">
            <div className="px-4 py-5 font-mono text-sm font-semibold">
              <span className="text-accent">~/</span>study-hub
            </div>
            <Suspense fallback={null}>
              <SidebarNav />
            </Suspense>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center gap-2 border-b bg-panel px-4 py-2 md:hidden">
              <span className="font-mono text-sm font-semibold">~/study-hub</span>
              <div className="ml-auto">
                <Suspense fallback={null}>
                  <Nav compact />
                </Suspense>
              </div>
            </header>
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
```

> `Nav` 用了 `useSearchParams()`，必须包在 `<Suspense>` 里，否则构建报错。

### M2.4 树形侧边栏

三个文件，职责分离：

| 文件 | 类型 | 职责 |
|---|---|---|
| `components/nav-items.ts` | **普通模块**（不能加 `"use client"`） | `NavNode` 类型 + 顶层菜单 `TOP_ITEMS` |
| `components/SidebarNav.tsx` | 服务端组件 | 查库拼出完整树：非归档项目（节点下挂项目文档、角标显示未完成待办数、暂停项目变暗）、知识库文件夹树 |
| `components/Nav.tsx` | 客户端组件 | 渲染树、高亮当前路由、展开/折叠状态 |

```ts
// nav-items.ts — must stay a plain module: values exported from a "use client" module
// become client references when imported by a server component.
export type NavNode = {
  id: string;        // stable unique id, also the expansion-state key
  label: string;
  href: string;      // may include a query string, matched exactly
  icon?: string;
  count?: number;
  dim?: boolean;
  children?: NavNode[];
};

export const TOP_ITEMS: NavNode[] = [
  { id: "home", href: "/", label: "首页", icon: "⌂" },
  { id: "projects", href: "/projects", label: "项目", icon: "▤" },
  { id: "todos", href: "/todos", label: "任务", icon: "✓" },
  { id: "kb", href: "/kb", label: "知识库", icon: "≡" },
];
```

`SidebarNav.tsx` 中知识库树的构建（把扁平文章列表转成嵌套文件夹）：

```ts
function buildKbTree(articles: KbMeta[]): NavNode[] {
  const root: NavNode[] = [];
  const folders = new Map<string, NavNode>();
  const folderNode = (fpath: string): NavNode => {
    let n = folders.get(fpath);
    if (!n) {
      const cut = fpath.lastIndexOf("/");
      const parent = cut === -1 ? "" : fpath.slice(0, cut);
      n = { id: `kb-folder-${fpath}`, label: folderLabel(fpath.slice(cut + 1)), href: "/kb", children: [] };
      folders.set(fpath, n);
      (parent ? folderNode(parent).children! : root).push(n);
    }
    return n;
  };
  for (const a of articles) {
    const leaf: NavNode = { id: `kb-${a.slug}`, label: a.title, href: `/kb/${a.slug}` };
    (a.folder ? folderNode(a.folder).children! : root).push(leaf);
  }
  for (const n of folders.values()) n.count = n.children!.length;
  const isFolder = (n: NavNode) => n.id.startsWith("kb-folder-");
  // Folders first (alphabetical), then root articles in their original (date) order.
  return root.sort((a, b) => Number(isFolder(b)) - Number(isFolder(a)) || (isFolder(a) && isFolder(b) ? a.label.localeCompare(b.label) : 0));
}
```

`Nav.tsx` 的关键逻辑：

- `isActive(node, pathname, search)`：href 带 `?` 时 path 和 query 都精确匹配；`/` 只匹配首页；其余按前缀匹配（`pathname === href || pathname.startsWith(href + "/")`）。
- `activeTrail()`：深度优先找到**最深**的激活节点及其祖先 id 列表。
- 展开状态 `open: Record<id, boolean>` 只记录用户手动切换过的节点；没切换过的节点「在激活路径上就展开」。
- `compact` 模式（窄屏）只横排显示 `TOP_ITEMS`。

**M2 验收**：各顶层路由建占位页后都能访问；系统切换深浅色，文字对比度正常；窄屏出现顶部横排导航。

---

## M3 项目模块

### M3.1 查询 `src/db/queries/projects.ts`

```ts
import { asc, desc, eq, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db/client";
import { milestones, projectLogs, projects, todos } from "@/db/schema";

export async function getProjectsOverview() {
  await connection();
  const rows = db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      description: projects.description,
      status: projects.status,
      color: projects.color,
      targetDate: projects.targetDate,
      sortOrder: projects.sortOrder,
      // IMPORTANT: reference the outer column as raw text `projects.id`, not ${projects.id}
      // (see pitfalls: Drizzle renders it unqualified inside single-table selects).
      total: sql<number>`(select count(*) from milestones m where m.project_id = projects.id)`,
      done: sql<number>`(select count(*) from milestones m where m.project_id = projects.id and m.done = 1)`,
      nextDue: sql<string | null>`(select min(m.due_date) from milestones m where m.project_id = projects.id and m.done = 0 and m.due_date is not null)`,
      lastLog: sql<string | null>`(select max(l.date) from project_logs l where l.project_id = projects.id)`,
      openTodos: sql<number>`(select count(*) from todos t where t.project_id = projects.id and t.done = 0)`,
    })
    .from(projects)
    .orderBy(asc(projects.sortOrder), asc(projects.id))
    .all();
  const order = { active: 0, paused: 1, done: 2, archived: 3 } as const;
  return rows.sort((a, b) => order[a.status] - order[b.status] || a.sortOrder - b.sortOrder);
}

export async function getProjectDetail(id: number) {
  await connection();
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) return null;
  const ms = db.select().from(milestones).where(eq(milestones.projectId, id))
    .orderBy(asc(milestones.done), asc(milestones.sortOrder), asc(milestones.id)).all();
  const logs = db.select().from(projectLogs).where(eq(projectLogs.projectId, id))
    .orderBy(desc(projectLogs.date), desc(projectLogs.id)).all();
  const openTodos = db.select({ id: todos.id, title: todos.title, date: todos.date }).from(todos)
    .where(sql`${todos.projectId} = ${id} and ${todos.done} = 0`).orderBy(asc(todos.date)).all();
  return { project, milestones: ms, logs, openTodos };
}
```

### M3.2 Action 工具 `src/actions/_util.ts`

```ts
import { revalidatePath } from "next/cache";

/** The app is fully dynamic; revalidating the root layout refreshes whatever page called the action. */
export function bump() {
  revalidatePath("/", "layout");
}

export function num(v: FormDataEntryValue | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function str(v: FormDataEntryValue | null | undefined): string {
  return typeof v === "string" ? v.trim() : "";
}

export function slugify(s: string): string {
  const base = s.toLowerCase().replace(/[^a-z0-9一-龥]+/g, "-").replace(/^-+|-+$/g, "");
  return base || `p-${Date.now().toString(36)}`;
}

export function nowIso() {
  return new Date().toISOString();
}
```

> `_util.ts` **不加** `"use server"`：它导出的是普通工具函数，不应该暴露成可被浏览器调用的动作。

### M3.3 Actions `src/actions/projects.ts`

| 动作 | 签名 | 要点 |
|---|---|---|
| `createProject` | `(formData)` | slug 冲突时追加时间戳后缀；`sortOrder = max+1`；完成后 `redirect("/projects/<id>")` |
| `updateProject` / `updateProjectForm` | `(id, patch)` / `(formData)` | 状态白名单校验；日期用 `isValidDate`；刷新 `updatedAt` |
| `moveProject` | `(id, "up" \| "down")` | 取全部项目按序排列，交换相邻两项后**整体重新编号**（事务） |
| `deleteProject` | `(id)` | cascade 删除里程碑与日志；`redirect("/projects")` |
| `createMilestone` | `(formData)` | 需要 `projectId` + `title`；可选 `dueDate` |
| `setMilestoneStatus` | `(id, status)` | 见下方代码 |
| `updateMilestone` / `deleteMilestone` | | |
| `createLog` / `updateLogForm` / `deleteLog` | | `kind` 白名单；日期缺省为 `today()` |

```ts
/** todo → doing → done; `done`/`doneAt` follow the status so progress counters stay right. */
export async function setMilestoneStatus(id: number, status: MilestoneStatus) {
  if (!MILESTONE_STATUSES.includes(status)) return;
  const row = db.select().from(milestones).where(eq(milestones.id, id)).get();
  if (!row || row.status === status) return;
  const done = status === "done";
  db.update(milestones)
    .set({ status, done, doneAt: done ? (row.doneAt ?? nowIso()) : null })
    .where(eq(milestones.id, id))
    .run();
  db.update(projects).set({ updatedAt: nowIso() }).where(eq(projects.id, row.projectId)).run();
  bump();
}
```

### M3.4 页面与组件

**`/projects`**：两列卡片网格。每张卡：▲▼ 排序手柄、色点、名称、状态徽章、描述（两行截断）、进度条、下个截止（过期标红）、最近日志日期、待办数、目标日期；右上角「新建项目」按钮（弹出表单）。

**`/projects/[id]`**：

| 区域 | 内容 |
|---|---|
| 标题栏 | 色点 + 名称 + 状态；右侧「编辑项目」面板（名称/描述/状态/颜色/目标日期/删除） |
| 进度卡 | 进度条、目标日期、最后更新 |
| 文档卡 | `content/projects/<slug>/*.md` 列表（有文件才显示，见 M5） |
| 左列 | 任务列表 `TaskList`（固定本项目）；关联的未完成待办 |
| 右列 | 日志时间线 `LogTimeline` |

**`TaskList`（客户端组件）**：

- 每行：三段开关（待办 / 进行中 / 完成）→ 标题（双击编辑）→ 可选项目 chip → 截止日期（过期标红）→ 完成日期；悬停显示 ✎ 和 ×（删除前 `confirm()`）。
- 已完成的折叠在「▸ 已完成 N」下。
- 底部添加表单：传了 `projectId` 就用隐藏字段，否则显示项目下拉。提交后 `formRef.current?.reset()`。

**`LogTimeline`（客户端组件）**：

- 顶部是新建表单：日期、类型（笔记/实验/里程碑/阻塞）、标题、「预览 / 编辑」切换、Markdown 文本框。
- 按日期分组，左侧竖线 + 圆点；每条日志类型 chip 按颜色区分；悬停可编辑/删除。

客户端调用 Action 的标准写法：

```tsx
"use client";
import { useTransition } from "react";
import { deleteMilestone } from "@/actions/projects";

export function DeleteMilestoneButton({ id, title }: { id: number; title: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn btn-ghost btn-sm btn-danger"
      disabled={pending}
      onClick={() => {
        if (confirm(`删除任务「${title}」？`)) start(() => deleteMilestone(id));
      }}
    >
      ×
    </button>
  );
}
```

> 页面组件的 `params` 是 Promise：`export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; ... }`。`generateMetadata` 同理。

**M3 验收**：新建项目 → 添加 3 个任务 → 一个切到「进行中」、一个切到「完成」→ 列表页进度条显示 `1/3 · 33%`；写一条含表格和代码块的日志，渲染正确。

---

## M4 任务模块与首页仪表盘

### M4.1 查询 `src/db/queries/todos.ts`

| 函数 | 返回 |
|---|---|
| `getProjectsLite()` | 活跃项目的 id / name / color，给下拉框和 chip 用 |
| `getAllTodos()` | 全部待办 left join 项目名；排序：未完成在前 → 优先级降序 → 日期 → sortOrder |
| `getTodosByProject()` | `{ groups: [{ project(含里程碑统计), todos }], unassigned }`，项目按状态再按 sortOrder 排 |
| `getOpenTodoStats()` | 零散待办 `{ open, urgent, total }` |
| `getMilestoneTasks({ activeOnly })` | 所有里程碑作为任务行（带项目名/色/状态）；排序：doing → todo（按截止日期，空值最后）→ done（按完成时间倒序），再按项目顺序 |

`getMilestoneTasks` 参考实现：

```ts
export async function getMilestoneTasks(opts: { activeOnly?: boolean } = {}) {
  await connection();
  const rows = db
    .select({
      id: milestones.id,
      title: milestones.title,
      dueDate: milestones.dueDate,
      status: milestones.status,
      doneAt: milestones.doneAt,
      sortOrder: milestones.sortOrder,
      projectId: milestones.projectId,
      projectName: projects.name,
      projectColor: projects.color,
      projectStatus: projects.status,
      projectSort: projects.sortOrder,
    })
    .from(milestones)
    .innerJoin(projects, eq(projects.id, milestones.projectId))
    .all()
    .filter((r) => !opts.activeOnly || r.projectStatus === "active" || r.projectStatus === "paused");
  const rank = { doing: 0, todo: 1, done: 2 } as const;
  return rows.sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      (a.status === "done"
        ? (b.doneAt ?? "").localeCompare(a.doneAt ?? "")
        : (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")) ||
      a.projectSort - b.projectSort ||
      a.sortOrder - b.sortOrder ||
      a.id - b.id,
  );
}

export type MilestoneTask = Awaited<ReturnType<typeof getMilestoneTasks>>[number];
```

### M4.2 Actions `src/actions/todos.ts`

`createTodo(formData)`、`toggleTodo(id)`（切换时写/清 `doneAt`）、`updateTodo(id, patch)`、`deleteTodo(id)`、`clearDoneTodos(projectId | null)`。

### M4.3 `/todos` 页面

- 两列网格，每个非归档项目一张卡：色点 + 名称 + 状态 + 未完成数、进度条、最近日志、`TaskList`（固定本项目、不显示项目 chip），下面 `<details>` 折叠「零散待办」`ProjectTodoList`。
- 最后一张卡：「未归属项目的待办」，添加表单里带项目下拉。
- `ProjectTodoList`：复选框切换、双击编辑（标题/项目/优先级）、已完成折叠 +「清除」、优先级 `!` 标红。

### M4.4 首页 `/`

```
┌ 2026-01-01 周四                                         [按项目查看 →] ┐
│ ┌进行中┐ ┌待办┐ ┌本周完成┐ ┌零散待办┐                                   │
│ ┌──────────────── 任务（所有活跃/暂停项目，带项目 chip） ─────────────┐ │
│ │ TaskList                                                            │ │
└────────────────────────────────────────────────────────────────────────┘
```

统计直接在页面里由查询结果计算：

```ts
const today = todayFn();
const [tasks, projectsLite, todoStats] = await Promise.all([
  getMilestoneTasks({ activeOnly: true }),
  getProjectsLite(),
  getOpenTodoStats(),
]);
const { start } = weekRange(today);
const doing = tasks.filter((t) => t.status === "doing").length;
const todo = tasks.filter((t) => t.status === "todo").length;
const doneThisWeek = tasks.filter((t) => t.status === "done" && t.doneAt && t.doneAt.slice(0, 10) >= start).length;
const overdue = tasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today).length;
```

- 「进行中」卡副标题显示「N 条已过截止」，有逾期或有进行中时卡片边框高亮。
- 「零散待办」卡显示 `todoStats.open`，副标题显示高优先级数量。
- 任务卡标题栏右侧列出活跃项目 chip，点击跳转项目页。

> `doneAt` 是 UTC 的 ISO 字符串，截前 10 位和本地日期比较在时区跨零点时会有几个小时的误差；对周统计可以接受，要精确就先 `toLocalDate(new Date(doneAt))`。

**M4 验收**：用 `sqlite3 data/app.db "select status, count(*) from milestones group by status"` 抽查，首页数字一致。

---

## M5 知识库与项目文档

不进数据库，直接读 `content/` 下的 Markdown，**每次请求实时读盘**，新增文件刷新即上线，无需重新 build。

### M5.1 文件格式

```markdown
---
title: 文章标题
date: 2026-01-01
summary: 一句话摘要，显示在列表卡片上
tags: [tag-a, tag-b]
---

正文（GFM Markdown）……
```

- 知识库：`content/kb/<folder>/<name>.md`，slug 是相对路径去掉 `.md`（如 `ml/attention`），子目录即分组，支持多级。
- 项目文档：`content/projects/<项目 slug>/<name>.md`，出现在项目详情页和侧边栏项目节点下。
- 需要复杂交互图解时，把独立 HTML 放在 `public/` 下，在 md 里用链接指过去（注意生产模式下 `public/` 新文件要重新 build）。

### M5.2 `src/lib/kb/index.ts`

```ts
import fs from "node:fs/promises";
import path from "node:path";

const KB_DIR = path.resolve(process.cwd(), "content/kb");
const PROJECT_DOCS_DIR = path.resolve(process.cwd(), "content/projects");

/** Display names for folder segments; unlisted folders show their raw name. */
export const FOLDER_LABELS: Record<string, string> = {};
export const folderLabel = (segment: string) => FOLDER_LABELS[segment] ?? segment;

export type KbMeta = { slug: string; folder: string; title: string; date: string; summary: string; tags: string[] };
export type KbArticle = KbMeta & { body: string };

/** Minimal frontmatter parser: `key: value` lines between two `---` fences; tags as `[a, b]`. */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i !== -1) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2] };
}

function parseTags(s: string | undefined): string[] {
  if (!s) return [];
  return s.replace(/^\[|\]$/g, "").split(",").map((t) => t.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
}

async function readMdFile(absPath: string, slug: string): Promise<KbArticle> {
  const { meta, body } = parseFrontmatter(await fs.readFile(absPath, "utf8"));
  return {
    slug,
    folder: slug.includes("/") ? slug.slice(0, slug.lastIndexOf("/")) : "",
    title: meta.title || slug.split("/").pop()!,
    date: meta.date || "",
    summary: meta.summary || "",
    tags: parseTags(meta.tags),
    body,
  };
}

async function walk(dir: string, prefix: string): Promise<KbArticle[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: KbArticle[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(abs, prefix ? `${prefix}/${e.name}` : e.name)));
    else if (e.isFile() && e.name.endsWith(".md")) out.push(await readMdFile(abs, (prefix ? `${prefix}/` : "") + e.name.slice(0, -3)));
  }
  return out;
}

function stripBody({ slug, folder, title, date, summary, tags }: KbArticle): KbMeta {
  return { slug, folder, title, date, summary, tags };
}

const byDateDesc = (a: KbMeta, b: KbMeta) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title));

export async function listArticles(): Promise<KbMeta[]> {
  return (await walk(KB_DIR, "")).map(stripBody).sort(byDateDesc);
}

/** Every segment must be a plain file name: blocks ../ traversal and hidden files. */
function isSafeSlugPath(slug: string, maxDepth: number): boolean {
  const parts = slug.split("/");
  if (parts.length === 0 || parts.length > maxDepth) return false;
  return parts.every((p) => /^[\w.-]+$/.test(p) && p !== "." && p !== ".." && !p.startsWith("."));
}

export async function getArticle(slug: string): Promise<KbArticle | null> {
  if (!isSafeSlugPath(slug, 6)) return null;
  try {
    return await readMdFile(path.join(KB_DIR, `${slug}.md`), slug);
  } catch {
    return null;
  }
}

export async function listProjectDocs(projectSlug: string): Promise<KbMeta[]> {
  if (!isSafeSlugPath(projectSlug, 1)) return [];
  const dir = path.join(PROJECT_DOCS_DIR, projectSlug);
  let files: string[] = [];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }
  const docs = await Promise.all(
    files.filter((f) => f.endsWith(".md") && !f.startsWith(".")).map((f) => readMdFile(path.join(dir, f), f.slice(0, -3))),
  );
  return docs.map(stripBody).sort(byDateDesc);
}

export async function getProjectDoc(projectSlug: string, slug: string): Promise<KbArticle | null> {
  if (!isSafeSlugPath(projectSlug, 1) || !isSafeSlugPath(slug, 1)) return null;
  try {
    return await readMdFile(path.join(PROJECT_DOCS_DIR, projectSlug, `${slug}.md`), slug);
  } catch {
    return null;
  }
}
```

> 项目的 `slug` 由 `slugify` 生成，可能含中文；而 `isSafeSlugPath` 只允许 `[\w.-]`。如果项目名是中文，要么建项目时手填英文 slug，要么把正则放宽为 `/^[\w.\-一-龥]+$/`。

### M5.3 页面

- `/kb`（`export const dynamic = "force-dynamic"`）：按顶层文件夹分节，每节文章卡片（标题、日期、摘要、标签）；根目录文章归入「未分类」。
- `/kb/[...slug]`：catch-all 路由，`slug` 是数组，`slug.join("/")` 后调 `getArticle`；找不到 `notFound()`；正文 `<Markdown className="prose-article max-w-3xl">`。
- `/projects/[id]/docs/[slug]`：先查项目拿到 slug，再 `getProjectDoc`。

```tsx
// src/app/kb/[...slug]/page.tsx
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { BackLink, PageHeader } from "@/components/ui";
import { folderLabel, getArticle } from "@/lib/kb";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const a = await getArticle(slug.join("/"));
  return { title: a?.title ?? "知识库" };
}

export default async function KbArticlePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const a = await getArticle(slug.join("/"));
  if (!a) notFound();
  return (
    <div className="space-y-4">
      <BackLink href="/kb">知识库</BackLink>
      <PageHeader
        title={a.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {a.folder ? <span className="chip">{a.folder.split("/").map(folderLabel).join(" / ")}</span> : null}
            {a.date ? <span className="font-mono">{a.date}</span> : null}
            {a.tags.map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </span>
        }
      />
      <article className="card p-5 md:p-7">
        <Markdown className="prose-article max-w-3xl">{a.body}</Markdown>
      </article>
    </div>
  );
}
```

**M5 验收**：新建 `content/kb/test/hello.md`，不重启刷新即可看到；访问 `/kb/..%2F..%2Fpackage` 返回 404。

---

## M6 部署与运维

### M6.1 健康检查 `/api/health`

```ts
import { NextResponse } from "next/server";
import { sqlite } from "@/db/client";

export async function GET() {
  const row = sqlite.prepare("select count(*) as n from sqlite_master where type='table'").get() as { n: number };
  return NextResponse.json({ ok: true, tables: row.n, time: new Date().toISOString() });
}
```

> 健康检查不要返回数据库绝对路径等主机信息。

### M6.2 systemd 用户服务 `deploy/study-hub.service`

```ini
[Unit]
Description=Study Hub (Next.js on 127.0.0.1:3210)
After=network.target

[Service]
WorkingDirectory=<APP_DIR>
Environment=NODE_ENV=production
Environment=TZ=<Your/Timezone>
Environment=PATH=/usr/local/bin:/usr/bin:/bin
EnvironmentFile=<APP_DIR>/.env.local
# prestart hook in package.json runs the DB migration before `next start`
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=15

[Install]
WantedBy=default.target
```

> 如果 Node 是通过 nvm 等方式安装的，`/usr/bin/npm` 和 `PATH` 要改成实际路径（`which npm`）。

首次部署：

```bash
cd <APP_DIR>
npm install
npm run build
mkdir -p ~/.config/systemd/user
cp deploy/study-hub.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now study-hub

# Keep the service running after logout / reboot (needs sudo once)
sudo loginctl enable-linger "$USER"
loginctl show-user "$USER" | grep Linger   # expect Linger=yes
```

### M6.3 每日备份 `deploy/crontab.txt`

```cron
# Replace <APP_DIR>. Times are in the server timezone. `%` must be escaped as `\%` in crontab.
# Nightly SQLite backup, keep 14 days (.backup is a consistent snapshot even in WAL mode)
0 3 * * * mkdir -p <APP_DIR>/data/backups && sqlite3 <APP_DIR>/data/app.db ".backup <APP_DIR>/data/backups/app-$(date +\%F).db" && find <APP_DIR>/data/backups -name 'app-*.db' -mtime +14 -delete
```

安装（追加到现有 crontab）：

```bash
(crontab -l 2>/dev/null; sed "s|<APP_DIR>|$PWD|g" deploy/crontab.txt | grep -v '^#' | grep -v '^$') | crontab -
crontab -l
```

> 若 `sqlite3` 不在 cron 的默认 PATH 里，写绝对路径（`which sqlite3`）。
> 知识库文章在 `content/` 里，建议用 git 管理，不在数据库备份范围内。

### M6.4 上线检查

```bash
systemctl --user status study-hub            # active (running)
curl -s http://127.0.0.1:3210/api/health     # {"ok":true,...}
ss -ltnp | grep 3210                         # listening address as expected
journalctl --user -u study-hub -n 30         # "migrated ok" and "Ready"
```

从另一台电脑访问（只监听本机时）：

```bash
ssh -L 3210:127.0.0.1:3210 <user>@<server>
# then open http://127.0.0.1:3210 locally
```

### M6.5 日常运维

| 改动内容 | 需要做什么 |
|---|---|
| `content/**/*.md` | 什么都不用做，刷新即生效 |
| `public/` 下任何文件 | **必须** `npm run build && systemctl --user restart study-hub`（生产模式只服务构建时已存在的 public 文件） |
| `src/`、`package.json`、配置 | build + restart |
| schema | `db:generate` → 提交 → build + restart（prestart 自动迁移） |
| `.env.local` | 只需 restart |
| `deploy/crontab.txt` | 重装 crontab |

| 操作 | 命令 |
|---|---|
| 实时日志 | `journalctl --user -u study-hub -f` |
| 手动备份 | `sqlite3 data/app.db ".backup data/backups/manual-$(date +%F-%H%M).db"` |
| 恢复 | `systemctl --user stop study-hub && cp data/backups/app-XXXX.db data/app.db && rm -f data/app.db-wal data/app.db-shm && systemctl --user start study-hub` |
| 回滚代码 | `git checkout <good-commit> -- . && npm install && npm run build && systemctl --user restart study-hub`（跨迁移时先恢复对应备份） |

### M6.6 安全边界

- 默认只监听 `127.0.0.1`，唯一入口是 SSH 隧道。
- 改成 `0.0.0.0` 只限受信内网；要上公网必须先加反向代理 + 认证。
- 以后如果加给外部程序调用的接口，用请求头 token 校验（token 放 `.env.local`）。
- `.env.local`、`data/` 不入库。

---

## M7 测试与验证

项目不引入测试框架，验证分三层，从快到慢。每次改动至少跑第一层。

### 第一层：静态检查

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (next build does not lint any more)
```

两者必须零错误。

### 第二层：HTTP 巡检（服务运行中）

```bash
for p in / /todos /projects /projects/1 /kb /api/health; do
  printf "%-16s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3210$p")"
done
```

预期全部 200（`/projects/1` 需要至少有一个项目）。

### 第三层：浏览器端到端 `scripts/e2e.mjs`

```js
/* Usage: node scripts/e2e.mjs [baseUrl] [screenshotDir] */
import { chromium } from "playwright-core";
import fs from "node:fs";

const base = process.argv[2] ?? "http://127.0.0.1:3210";
const shots = process.argv[3] ?? "data/screenshots";
fs.mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, colorScheme: "dark" });
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });

const step = async (name, fn) => { process.stdout.write(`- ${name} … `); await fn(); console.log("ok"); };
const stamp = Date.now().toString(36);

await step("add a task on a project", async () => {
  await page.goto(`${base}/projects`);
  await page.locator(".card a").first().click();
  await page.fill('input[placeholder="新任务，回车提交"]', `e2e task ${stamp}`);
  await page.press('input[placeholder="新任务，回车提交"]', "Enter");
  await page.waitForSelector(`text=e2e task ${stamp}`);
});
await page.screenshot({ path: `${shots}/project.png`, fullPage: true });

// Add steps the same way: task status switch, log with a Markdown table, todos, kb, home stats.

await browser.close();
if (errors.length) {
  console.log("\nBrowser errors:\n  " + errors.join("\n  "));
  process.exit(1);
}
console.log(`\nall steps passed; screenshots in ${shots}/`);
```

建议覆盖：

1. 项目：加任务 → 切「进行中」「完成」→ 断言进度条数字变化；写含表格与代码块的日志，断言出现 `table`
2. 任务页：加零散待办 → 勾选 → 出现在「已完成」
3. 知识库：列表页出现文章卡片 → 点进详情渲染正文
4. 首页：统计卡与任务列表渲染

注意：

- 测试数据写进真实库，统一加 `e2e` 前缀，跑完用 SQL 清理（或用 `DB_PATH` 指向一份测试库另起一个服务）。
- 页面上同名按钮多时，用父容器的唯一特征限定选择器，如 `form:has(input[name="kind"]) button.btn-primary`。
- **截图核对数字**：HTTP 200 发现不了逻辑错误。

---

## 5. 踩坑清单

| # | 现象 | 根因 | 解法 |
|---|---|---|---|
| 1 | `npm install better-sqlite3` 编译失败，`-std=c++20` 不识别 | 12.x 没有 Node 20 预编译包，旧 gcc 不支持 C++20 | 固定 `better-sqlite3@^11.10.0`；或升级 Node / gcc |
| 2 | tsx 脚本报 `Top-level await is currently not supported with the "cjs" output format` | 项目非 ESM，tsx 按 CJS 编译 | `async function main()` + `main().catch(...)` |
| 3 | `Type '() => Promise<number>' is not assignable to type '(formData: FormData) => void \| Promise<void>'` | 把有返回值的 Action 直接当 `<form action>` | 在服务端组件内定义内联 `async function f() { "use server"; await action(); }` 包一层 |
| 4 | eslint `react-hooks/static-components` | 在渲染函数里定义了子组件，每次渲染都是新类型 | 改成普通函数 `renderX()` 返回 JSX |
| 5 | **所有项目进度都显示同样的错误数字** | Drizzle 单表 select 里把 `${projects.id}` 渲染成不带表名的 `"id"`，子查询 `where m.project_id = "id"` 被解析成子查询自己表的 id | 相关子查询里的外层列**直接写原始文本** `projects.id` |
| 6 | 服务端组件里 import 客户端模块导出的常量，得到的是奇怪的引用对象 | `"use client"` 模块的导出在服务端变成 client reference | 共享常量/类型放到不带指令的普通模块 |
| 7 | `curl ... \| grep '0/3'` 找不到 | React 把 `{a}/{b}` 渲染成 `0<!-- -->/<!-- -->3` | 用无头浏览器读 `innerText` |
| 8 | `pkill -f "next dev"` 把自己的 shell 也杀了 | `-f` 匹配整条命令行 | 先 `pgrep -f next-server` 看 PID，或 `fuser -k 3210/tcp` |
| 9 | 生产模式下 `public/` 新文件 404，而新 md 正常 | `next start` 只服务构建时已存在的 public 文件；md 是每次请求读盘 | build + restart |
| 10 | 删除路由后 `npm run build` 报 `.next/dev/types/validator.ts` 找不到旧页面 | dev server 残留的类型文件 | `rm -rf .next/dev/types` |
| 11 | 时间比较永远不成立 | `CURRENT_TIMESTAMP`（`2026-01-01 11:00:00`）和 ISO（`2026-01-01T11:00:00.000Z`）格式不同，字符串比较无意义 | 同一字段统一一种格式；比较前用 SQLite `datetime()` 归一 |
| 12 | 「今天」日期偏一天 | 用了 `new Date().toISOString().slice(0,10)`（UTC） | 统一走 `today()`；检查 `date`、unit `TZ=`、`env.ts` 三处一致 |
| 13 | systemd 下找不到 `node` / `npm` | 服务 PATH 很短 | unit 里写绝对路径或补全 `PATH` |
| 14 | `useSearchParams()` 导致构建报错 | 需要 Suspense 边界 | 使用它的客户端组件外包 `<Suspense>` |
| 15 | 中文名项目的文档不显示 | 自动生成的 slug 含中文，被路径安全校验拒绝 | 手填英文 slug，或放宽 `isSafeSlugPath` 正则 |

快速排障表：

| 症状 | 先看 |
|---|---|
| 页面打不开 | `systemctl --user status study-hub`、`ss -ltnp \| grep 3210`、SSH 隧道 |
| 页面 500 | `journalctl --user -u study-hub -n 50` |
| 数据库锁 | 是否有第二个进程（如 `drizzle-kit studio`）打开了库 |
| 新文章不出现 | frontmatter 的 `---` 是否顶格；文件扩展名是否 `.md`；文件名是否只含字母数字 `_ . -` |

---

## 6. 扩展路线

| 功能 | 做法提示 |
|---|---|
| 周报 | 按周聚合完成任务、项目日志，导出 Markdown |
| 待办拖拽排序 | 已有 `sort_order` 列，补前端拖拽和 `reorderTodos` 动作 |
| 习惯打卡 / 时间块 | 新表 `habits`、`habit_checkins(habit_id, date) unique`、`time_blocks(date, start_min, end_min, kind planned\|actual)`；时间用「距 0 点分钟数」整数避免时区问题 |
| 全文搜索 | 知识库文章数量大后，用 SQLite FTS5 建索引，或启动时构建内存倒排表 |
| 局域网 / 公网访问 | 反向代理（Caddy / Nginx）+ Basic Auth 或 OAuth |

### 标准改动流程

```
改 schema（如需要）→ db:generate → migrate → 改 queries → 改 actions → 改组件/页面
→ typecheck + lint → dev 手动点一遍 / 跑 e2e → build → restart → 更新 docs
```

### 代码风格约定

- 界面文案用中文（或你的母语），代码标识符英文。
- 组件文件一个主导出；只有需要事件 / 状态时才加 `"use client"`。
- 查询函数返回普通对象；类型用 `Awaited<ReturnType<typeof fn>>[number]` 导出给组件。
- 不引入 UI 组件库；复用 `.btn .card .input .chip`。
- 图表优先内联 SVG，避免大依赖。
- 破坏性操作前 `confirm()`。

---

## 附录 A：让 AI 编码助手按阶段实现

如果用 Claude Code / Cursor 等工具来写，建议**一个阶段一个会话**，每次把本文对应章节贴进去，并附上这些约束：

```
Context: Next.js 16 App Router + TypeScript + Drizzle + better-sqlite3 + Tailwind v4.
Before writing code, read node_modules/next/dist/docs/ — APIs differ from older Next.js
(params/searchParams are Promises, use connection() for dynamic data, next build does not lint).

Rules:
- Pages read via src/db/queries/* (first line: await connection()); all writes go through
  "use server" actions in src/actions/* that validate input and end with bump().
- Knowledge-base content is read from content/**/*.md via src/lib/kb, never stored in the DB.
- Dates are YYYY-MM-DD strings computed with today() from src/lib/dates.ts.
- In correlated subqueries reference outer columns as raw text (projects.id), not ${projects.id}.

Task: implement milestone <Mx> exactly as described below, then run
npm run typecheck && npm run lint and fix every error.

<paste the milestone section here>
```

每个阶段结束时，按该阶段的「验收」逐条手动确认，再进入下一阶段。
