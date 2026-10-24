import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { SidebarNav } from "@/components/SidebarNav";

export const metadata: Metadata = {
  title: { default: "Study Terminal", template: "%s · Study Terminal" },
  description: "个人学习终端：项目进展 · 任务 · 知识库",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <aside className="hidden w-56 shrink-0 border-r bg-panel md:sticky md:top-0 md:flex md:h-screen md:flex-col">
            <div className="px-4 py-5">
              <div className="font-mono text-sm font-semibold tracking-tight">
                <span className="text-accent">~/</span>study-terminal
              </div>
              <div className="mt-0.5 text-[11px] text-muted">localhost · :3210</div>
            </div>
            <Suspense fallback={null}>
              <SidebarNav />
            </Suspense>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center gap-2 border-b bg-panel px-4 py-2 md:hidden">
              <span className="font-mono text-sm font-semibold">~/study-terminal</span>
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
