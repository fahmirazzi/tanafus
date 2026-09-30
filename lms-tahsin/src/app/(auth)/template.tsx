/** Transisi masuk/daftar: form naik-memudar singkat (lihat template dashboard). */
export default function AuthTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]">
      {children}
    </div>
  );
}
