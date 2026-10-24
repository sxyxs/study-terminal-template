import { NextResponse } from "next/server";
import { sqlite } from "@/db/client";
import { env } from "@/lib/env";

export async function GET() {
  const row = sqlite.prepare("select count(*) as n from sqlite_master where type='table'").get() as { n: number };
  return NextResponse.json({
    ok: true,
    dbPath: env.dbPath,
    tables: row.n,
    time: new Date().toISOString(),
    version: process.env.npm_package_version ?? "0.1.0",
  });
}
