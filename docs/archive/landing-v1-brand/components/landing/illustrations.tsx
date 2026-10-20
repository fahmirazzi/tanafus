/**
 * Ilustrasi halaman depan. SVG inline, memakai token warna brand, tanpa aset
 * eksternal dan tanpa stok gambar.
 *
 * Aturan yang dipatuhi (docs/11-brand-guidelines.md §6):
 * - Sosok digambar tanpa wajah. Ini lazim di materi pendidikan Islam
 *   Indonesia dan menghindarkan kita dari menggambar anak tertentu.
 * - Mushaf muncul sebagai benda yang sedang dipakai belajar, bukan sebagai
 *   hiasan latar.
 * - Geometri Islami dipakai tipis dan terbatas, bukan sebagai wallpaper.
 */

/** Bintang delapan (dua persegi bertumpuk) — motif penanda, bukan hiasan. */
export function BintangDelapan({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* Rub el Hizb (۞): dua persegi bertumpuk 45° — tanda pembagi bacaan di
          dalam mushaf. Bukan bintang empat sudut; yang
          terakhir itu ikon "sparkle" generik, bukan motif Islami. */}
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      >
        <path d="M4.93 4.93H19.07V19.07H4.93Z" />
        <path d="M12 2 22 12 12 22 2 12Z" />
      </g>
    </svg>
  );
}

/** Pembatas antar bagian. */
export function PembatasBintang() {
  return (
    <div className="flex items-center justify-center gap-4" aria-hidden="true">
      <span className="h-px w-16 bg-plum-200" />
      <BintangDelapan className="size-5 text-orange-500" />
      <span className="h-px w-16 bg-plum-200" />
    </div>
  );
}

/**
 * Ilustrasi hero: satu sesi tahsin online. Guru membaca dari mushaf di atas
 * rehal, suaranya sampai ke murid, dan yang tertinggal dari sesi itu adalah
 * penilaian — tiga hal yang menjadi inti produk, dalam satu gambar.
 */
export function IlustrasiSesi({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 460 400"
      role="img"
      aria-label="Seorang guru membacakan Al-Qur'an dari mushaf di atas rehal, suaranya sampai ke murid lewat sesi daring, lalu penilaian sesi tercatat."
      className={className}
    >
      {/* Motif latar, sangat tipis */}
      <g
        className="text-plum-300"
        opacity="0.22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      >
        <path d="M372.2 48.2H411.8V87.8H372.2Z" />
        <path d="M392 40 420 68 392 96 364 68Z" />
        <path d="M29.9 305.9H58.1V334.1H29.9Z" />
        <path d="M44 300 64 320 44 340 24 320Z" />
      </g>

      {/* ---------- Panel guru ---------- */}
      <rect
        x="16"
        y="28"
        width="264"
        height="186"
        rx="18"
        className="fill-white stroke-plum-200"
        strokeWidth="1.5"
      />

      {/* Sosok guru, tanpa wajah */}
      <circle cx="86" cy="86" r="21" className="fill-plum-300" />
      <path
        d="M52 148c0-19 15.2-34 34-34s34 15 34 34v6H52z"
        className="fill-plum-700"
      />

      {/* Rehal + mushaf terbuka */}
      <g>
        <path
          d="M170 156 214 118M214 156 170 118"
          className="stroke-plum-400"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M150 124c14-8 28-8 42 0v34c-14-8-28-8-42 0z"
          className="fill-cream-100 stroke-plum-300"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M192 124c14-8 28-8 42 0v34c-14-8-28-8-42 0z"
          className="fill-cream-100 stroke-plum-300"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M192 124v34" className="stroke-plum-400" strokeWidth="1.5" />
        <g className="stroke-plum-300" strokeWidth="1.5" strokeLinecap="round">
          <path d="M158 134h26M158 142h26M200 134h26M200 142h26" />
        </g>
      </g>

      {/* Suara guru — inti tahsin adalah koreksi lisan */}
      <g
        className="stroke-orange-500"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      >
        <path d="M118 96a20 20 0 0 1 0 22" />
        <path d="M130 88a34 34 0 0 1 0 38" />
        <path d="M142 80a48 48 0 0 1 0 54" />
      </g>

      {/* ---------- Garis sambung antar panel ---------- */}
      <path
        d="M150 214c0 28 60 22 96 36"
        className="stroke-orange-500"
        strokeWidth="2.5"
        fill="none"
        strokeDasharray="3 9"
        strokeLinecap="round"
      />

      {/* ---------- Panel murid ---------- */}
      <rect
        x="180"
        y="232"
        width="264"
        height="140"
        rx="18"
        className="fill-white stroke-plum-200"
        strokeWidth="1.5"
      />

      {/* Sosok murid, lebih kecil */}
      <circle cx="238" cy="284" r="17" className="fill-orange-500" />
      <path
        d="M211 336c0-15 12-27 27-27s27 12 27 27v4h-54z"
        className="fill-plum-700"
      />

      {/* Yang tertinggal dari sesi: penilaian */}
      <g>
        <rect
          x="290"
          y="266"
          width="130"
          height="74"
          rx="10"
          className="fill-cream-100 stroke-plum-200"
          strokeWidth="1.5"
        />
        <g>
          <rect x="304" y="282" width="102" height="6" rx="3" className="fill-white" />
          <rect x="304" y="282" width="78" height="6" rx="3" className="fill-orange-500" />
          <rect x="304" y="298" width="102" height="6" rx="3" className="fill-white" />
          <rect x="304" y="298" width="61" height="6" rx="3" className="fill-orange-500" />
          <rect x="304" y="314" width="102" height="6" rx="3" className="fill-white" />
          <rect x="304" y="314" width="88" height="6" rx="3" className="fill-orange-500" />
        </g>
      </g>
    </svg>
  );
}
