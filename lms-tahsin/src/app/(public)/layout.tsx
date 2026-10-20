import Link from "next/link";
import { HeaderRingkas } from "@/components/layout/header-ringkas";
import { tautan } from "@/components/landing/gaya";

/** Layout halaman publik — tanpa auth, tanpa sidebar dashboard. */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <HeaderRingkas>
        <Link href="/login" className={`${tautan} text-sm font-medium`}>
          Masuk
        </Link>
      </HeaderRingkas>
      <main className="flex-1 px-4 pb-16">
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
