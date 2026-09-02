import Link from "next/link";

/** Layout halaman publik — tanpa auth, tanpa sidebar dashboard. */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col bg-cream-50">
      <header className="flex items-center justify-between px-5 py-6">
        <Link
          href="/"
          className="font-heading text-xl font-semibold text-plum-800"
        >
          Tanafus Center
        </Link>
        <Link
          href="/login"
          className="text-sm text-plum-700 underline underline-offset-4"
        >
          Masuk
        </Link>
      </header>
      <main className="flex-1 px-4 pb-16">
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
