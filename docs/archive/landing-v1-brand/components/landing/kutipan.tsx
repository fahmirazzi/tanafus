import { BintangDelapan } from "./illustrations";

/**
 * Kutipan ayat atau hadits.
 *
 * ⚠️ VERIFIKASI SEBELUM PUBLIKASI. Teks Arab dan terjemahannya diambil dari
 * nash yang sangat masyhur, tapi NOMOR RUJUKAN hadits belum diverifikasi ke
 * sumber cetak. Halaman yang menjual ketelitian bacaan Al-Qur'an tidak boleh
 * menayangkan rujukan yang belum dicek. Minta seorang yang berkompeten
 * memeriksa `rujukan` di docs/13-landing-page-copy.md sebelum halaman ini
 * ditayangkan.
 *
 * Aturan pemakaian (docs/11-brand-guidelines.md §6a): kutipan tampil sebagai
 * ISI dengan rujukan lengkap dan terjemahan — tidak pernah sebagai latar,
 * tidak pernah dipotong sampai berubah makna, dan tidak pernah ditempel di
 * belakang teks promosi.
 */
export function Kutipan({
  arab,
  terjemahan,
  rujukan,
  perluVerifikasi = false,
}: {
  arab: string;
  terjemahan: string;
  rujukan: string;
  perluVerifikasi?: boolean;
}) {
  return (
    <figure className="mx-auto max-w-2xl text-center">
      <BintangDelapan
        className="mx-auto size-5 text-orange-500"
        aria-hidden="true"
      />
      <blockquote className="mt-6">
        <p
          lang="ar"
          dir="rtl"
          className="font-arabic text-[1.75rem] leading-[2.2] text-plum-900 md:text-[2.125rem]"
        >
          {arab}
        </p>
        <p className="mt-5 text-lg leading-relaxed text-plum-700">
          “{terjemahan}”
        </p>
      </blockquote>
      <figcaption className="mt-4 text-base text-plum-500">
        {rujukan}
        {perluVerifikasi ? (
          <span className="ml-2 rounded border border-dashed border-plum-300 px-2 py-0.5 text-sm">
            rujukan belum diverifikasi
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
