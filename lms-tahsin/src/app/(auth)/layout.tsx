import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col bg-cream-50">
      <header className="px-5 py-6">
        <Link href="/" className="font-heading text-xl font-semibold text-plum-800">
          Tanafus Center
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
