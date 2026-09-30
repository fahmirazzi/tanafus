import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Logo teks Tanafus + titik merah, dipakai di seluruh aplikasi. Titiknya
 * melompat kecil saat disorot, sama dengan navigasi halaman depan.
 */
export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group/logo inline-flex items-baseline gap-0.5 rounded-full text-lg font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
        className,
      )}
    >
      Tanafus
      <span
        aria-hidden="true"
        className="size-[0.3em] rounded-full bg-primary transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/logo:-translate-y-1.5 motion-reduce:transition-none"
      />
    </Link>
  );
}
