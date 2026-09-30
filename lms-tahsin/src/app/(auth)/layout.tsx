import { HeaderRingkas } from "@/components/layout/header-ringkas";

/**
 * Layout masuk/daftar: kertas brand, form di dalam kartu, dan kaligrafi
 * تنافس (nama kami, "saling berlomba") besar dan pudar di latar, seperti
 * halaman depan. Kaligrafi hanya dekorasi: tidak pernah ayat atau lafaz Allah.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-x-clip bg-background">
      <span
        aria-hidden="true"
        lang="ar"
        dir="rtl"
        className="pointer-events-none absolute -bottom-[0.35em] -right-[0.05em] -z-10 select-none font-ld-decor text-[clamp(10rem,32vw,28rem)] leading-none text-foreground opacity-[0.05]"
      >
        تنافس
      </span>
      <HeaderRingkas />
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 md:pt-10">
        <div className="w-full max-w-md rounded-3xl bg-card p-7 ring-1 ring-border md:p-9">
          {children}
        </div>
      </main>
    </div>
  );
}
