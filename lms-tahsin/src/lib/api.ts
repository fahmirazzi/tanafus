import { NextResponse } from "next/server";
import { z } from "zod";

/** Batas pagination wajib untuk semua endpoint list (NFR-1). */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function parsePagination(url: URL): Pagination {
  const parsed = paginationSchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  return parsed.success
    ? parsed.data
    : { page: 1, pageSize: DEFAULT_PAGE_SIZE };
}

export function toPrismaPagination(p: Pagination): { skip: number; take: number } {
  return { skip: (p.page - 1) * p.pageSize, take: p.pageSize };
}

export function apiOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}

export function apiList<T>(
  items: T[],
  total: number,
  p: Pagination,
): NextResponse {
  return NextResponse.json({
    ok: true,
    data: items,
    meta: {
      page: p.page,
      pageSize: p.pageSize,
      total,
      totalPages: Math.ceil(total / p.pageSize),
    },
  });
}

export function apiError(
  message: string,
  status: number,
  details?: unknown,
): NextResponse {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

/** Ubah ZodError menjadi { field: pesan } yang aman dikirim ke client. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
