import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { hasBlockers, resolveReportCardView } from "@/lib/report-card";
import {
  computeReportCards,
  publishBlockersFor,
  storedReportCardFrom,
} from "@/lib/report-card-data";
import { formatTanggalJamWIB } from "@/lib/datetime";
import { ReportCardStatus, RoleName } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PublishPanel } from "./publish-panel";

export const metadata: Metadata = { title: "Publikasi Rapor" };

const REPORT_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  published: "Terbit",
};

/**
 * Satu baris gerbang publikasi: hijau bila kosong, merah bila berisi —
 * dengan daftar isinya, supaya admin bisa bertindak langsung dari layar ini
 * (spec B4 §4.4) alih-alih menebak sesi/murid mana yang bermasalah.
 */
function GateRow({
  title,
  emptyLabel,
  items,
}: {
  title: string;
  emptyLabel: string;
  items: Array<{ key: string; label: ReactNode }>;
}) {
  const empty = items.length === 0;
  return (
    <div
      className={
        empty
          ? "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-500/40 dark:bg-emerald-500/10"
          : "rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2"
      }
    >
      <p
        className={
          empty
            ? "text-sm font-semibold text-emerald-700 dark:text-emerald-300"
            : "text-sm font-semibold text-destructive"
        }
      >
        {title} — {empty ? emptyLabel : `${items.length} bermasalah`}
      </p>
      {!empty && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-plum-700">
          {items.map((it) => (
            <li key={it.key}>{it.label}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Layar publikasi rapor sekelas untuk admin (spec B4 §4.4, §4.8).
 *
 * computeReportCards() dipanggil SEKALI di sini, lalu hasilnya diteruskan ke
 * publishBlockersFor() sebagai argumen kedua — persis pola yang sama dengan
 * GET /api/class-groups/[id]/report-cards dan layar rapor guru (Task 10):
 * tanpa ini, findUnique + kedua findMany di dalam computeReportCards akan
 * dijalankan dua kali untuk data yang identik pada layar yang paling sering
 * dibuka admin menjelang tutup periode.
 */
export default async function AdminReportCardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(RoleName.super_admin, RoleName.admin);
  const { id } = await params;

  const group = await prisma.classGroup.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!group) notFound();

  const [computations, existing] = await Promise.all([
    computeReportCards(id),
    prisma.reportCard.findMany({
      where: { enrollment: { classGroupId: id } },
      // Kolom snapshot lengkap (lihat ReportCardSnapshotRow). Layar ini tidak
      // menampilkan rincian per kriteria, tapi `scores` dan ketiga kolom sesi
      // tetap ikut di-select supaya barisnya bisa diserahkan apa adanya ke
      // resolveReportCardView: satu bentuk snapshot untuk keempat pemanggil.
      // Bentuk yang dipangkas per layar persis yang dulu membuat keputusan
      // beku/segar ditulis ulang empat kali dan menyimpang di salah satunya.
      select: {
        enrollmentId: true,
        status: true,
        finalGradeOverride: true,
        finalGradeComputed: true,
        attendancePct: true,
        sessionsHeld: true,
        sessionsAttended: true,
        attendanceThresholdPct: true,
        eligibleForNextLevel: true,
        scores: {
          select: {
            criterionId: true,
            averageScore: true,
            sessionsScored: true,
          },
        },
      },
    }),
  ]);
  const blockers = await publishBlockersFor(id, computations);
  const blocked = hasBlockers(blockers);

  const byEnrollment = new Map(existing.map((r) => [r.enrollmentId, r]));
  const alreadyPublished = existing.some(
    (r) => r.status === ReportCardStatus.published,
  );

  const rows = computations.map((c) => {
    const row = byEnrollment.get(c.enrollmentId);
    // Baris terbit membaca snapshot, draft membaca hitungan hari ini, dan
    // nilai akhir EFEKTIF (timpaan menang atas hitungan) mengikuti logika
    // `effective` di POST .../publish — semuanya satu keputusan di
    // resolveReportCardView. Di layar ini admin sedang menimbang APAKAH akan
    // menerbitkan, jadi angka yang relevan adalah angka yang BENAR-BENAR
    // akan tertulis ke Enrollment.finalGrade begitu tombol terbit ditekan,
    // termasuk untuk draft yang gurunya sudah menimpa nilainya sebelum
    // terbit.
    const view = resolveReportCardView(
      c,
      row ? storedReportCardFrom(row) : null,
    );

    return {
      studentId: c.studentId,
      studentName: c.studentName,
      attendancePct: view.attendancePct,
      finalGrade: view.finalGrade,
      eligible: view.eligibleForNextLevel,
      status: row?.status ?? null,
    };
  });

  // Peringatan, BUKAN penghalang (spec B4 §4.4): murid tanpa nilai tetap
  // boleh masuk rapor dan tidak menghalangi penerbitan.
  const studentsWithoutScores = computations
    .filter((c) => c.averages.length === 0)
    .map((c) => ({ studentId: c.studentId, fullName: c.studentName }));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="xs"
          nativeButton={false}
          render={<Link href={`/admin/classes/${id}`} />}
        >
          <ChevronLeft data-icon="inline-start" />
          Kembali ke detail kelas
        </Button>

        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
            Publikasi Rapor — {group.name}
          </h1>
          <p className="text-sm text-plum-500">
            Periksa ketiga gerbang di bawah sebelum menerbitkan rapor sekelas.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status gerbang publikasi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <GateRow
            title="Kewajiban make-up terbuka"
            emptyLabel="tidak ada"
            items={blockers.outstandingMakeups.map((s) => ({
              key: s.sessionId,
              label: (
                <>
                  Sesi {formatTanggalJamWIB(s.scheduledAt)} dibatalkan
                  lembaga, belum ada penggantinya. Lihat{" "}
                  <Link
                    href={`/admin/classes/${id}`}
                    className="underline"
                  >
                    detail kelas
                  </Link>
                  .
                </>
              ),
            }))}
          />
          <GateRow
            title="Sesi belum ditutup"
            emptyLabel="tidak ada"
            items={blockers.staleSessions.map((s) => ({
              key: s.sessionId,
              label: (
                <>
                  Sesi {formatTanggalJamWIB(s.scheduledAt)} masih
                  &quot;terjadwal&quot; padahal jamnya sudah lewat. Lihat{" "}
                  <Link
                    href={`/admin/classes/${id}`}
                    className="underline"
                  >
                    detail kelas
                  </Link>
                  .
                </>
              ),
            }))}
          />
          <GateRow
            title="Murid tanpa sesi"
            emptyLabel="tidak ada"
            items={blockers.studentsWithoutSessions.map((s) => ({
              key: s.studentId,
              label: (
                <Link href={`/admin/users/${s.studentId}`} className="underline">
                  {s.fullName}
                </Link>
              ),
            }))}
          />
        </CardContent>
      </Card>

      {studentsWithoutScores.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-semibold">
            Murid tanpa nilai (bukan penghalang, tetap masuk rapor):
          </p>
          <ul className="list-disc pl-5">
            {studentsWithoutScores.map((s) => (
              <li key={s.studentId}>{s.fullName}</li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ringkasan murid ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-plum-500">
              Belum ada murid terdaftar di kelas ini.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Murid</TableHead>
                  <TableHead>Kehadiran</TableHead>
                  <TableHead>Nilai akhir</TableHead>
                  <TableHead>Kelayakan</TableHead>
                  <TableHead>Status rapor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.studentId}>
                    <TableCell>{r.studentName}</TableCell>
                    <TableCell>
                      {/* Jujur, bukan "0%" — kehadiran null berarti belum
                          ada sesi yang bisa dihitung untuk murid ini. */}
                      {r.attendancePct === null ? "—" : `${r.attendancePct}%`}
                    </TableCell>
                    <TableCell>
                      {r.finalGrade === null ? "—" : r.finalGrade}
                    </TableCell>
                    <TableCell>
                      {r.eligible === null
                        ? "Belum dapat dinilai"
                        : r.eligible
                          ? "Layak"
                          : "Belum layak"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === ReportCardStatus.published
                            ? "default"
                            : "secondary"
                        }
                      >
                        {r.status ? REPORT_STATUS_LABEL[r.status] : "Belum disusun"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PublishPanel
        classGroupId={id}
        hasBlockers={blocked}
        alreadyPublished={alreadyPublished}
      />
    </div>
  );
}
