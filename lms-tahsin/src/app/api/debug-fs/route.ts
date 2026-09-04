import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/** Debug sementara: cek isi folder Prisma client di bundle Vercel yang sesungguhnya. */
export async function GET(): Promise<NextResponse> {
  const dir = path.join(process.cwd(), "src", "generated", "prisma");
  let entries: string[] = [];
  let error: string | null = null;
  try {
    entries = fs.readdirSync(dir);
  } catch (e) {
    error = String(e);
  }
  return NextResponse.json({
    cwd: process.cwd(),
    dir,
    entries,
    error,
  });
}
