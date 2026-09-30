/**
 * Transisi halaman dashboard: template dipasang ulang di setiap navigasi,
 * jadi isi halaman baru masuk dengan naik-memudar singkat. Mati bila
 * pengguna meminta gerak dikurangi (motion-safe).
 */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]">
      {children}
    </div>
  );
}
