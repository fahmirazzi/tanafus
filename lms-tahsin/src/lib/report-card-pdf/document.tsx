import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { formatTanggalWIB } from "@/lib/datetime";
import type { ReportCardPdfData } from "./data";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, lineHeight: 1.5 },
  bismillah: { fontFamily: "Naskh", fontSize: 16, textAlign: "center", marginBottom: 4 },
  title: { fontSize: 15, textAlign: "center", marginBottom: 2 },
  subtitle: { fontSize: 9, textAlign: "center", color: "#555", marginBottom: 18 },
  sectionTitle: { fontSize: 11, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ccc", paddingVertical: 4 },
  headRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", paddingVertical: 4 },
  cellWide: { flex: 3 },
  cell: { flex: 1, textAlign: "right" },
  note: { marginTop: 6, fontFamily: "Naskh" },
  noteRevision: { marginTop: 4, fontSize: 8, color: "#666" },
  footer: { marginTop: 24, fontSize: 8, color: "#666" },
});

const pct = (value: number | null): string =>
  value === null ? "—" : `${value.toFixed(2)}%`;

const grade = (value: number | null): string =>
  value === null ? "Belum dinilai" : value.toFixed(2);

const verdict = (eligible: boolean | null): string => {
  if (eligible === null) return "Belum bisa dinyatakan";
  return eligible ? "Memenuhi syarat naik level" : "Belum memenuhi syarat naik level";
};

/**
 * Rapor periode satu murid (spec B4 §4.6).
 *
 * Catatan guru dan basmalah memakai fontFamily "Naskh" karena keduanya bisa
 * memuat aksara Arab. Font itu didaftarkan di render.ts — di sanalah juga
 * alasan kenapa harus TTF.
 */
export function ReportCardDocument({ data }: { data: ReportCardPdfData }) {
  return (
    <Document title={`Rapor ${data.studentName}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.bismillah}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
        <Text style={styles.title}>Rapor Periode</Text>
        <Text style={styles.subtitle}>
          {data.courseName} · {data.className} · {data.periodName} (
          {formatTanggalWIB(data.periodStart)} – {formatTanggalWIB(data.periodEnd)})
        </Text>

        <Text style={styles.sectionTitle}>Identitas</Text>
        <View style={styles.row}>
          <Text style={styles.cellWide}>Nama murid</Text>
          <Text style={styles.cell}>{data.studentName}</Text>
        </View>

        <Text style={styles.sectionTitle}>Kehadiran</Text>
        <View style={styles.row}>
          <Text style={styles.cellWide}>
            Hadir {data.sessionsAttended} dari {data.sessionsHeld} sesi yang berlangsung
          </Text>
          <Text style={styles.cell}>{pct(data.attendancePct)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cellWide}>Ambang kehadiran yang berlaku</Text>
          <Text style={styles.cell}>{data.thresholdPct.toFixed(2)}%</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cellWide}>Kelayakan naik level</Text>
          <Text style={styles.cell}>{verdict(data.eligible)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Nilai per kriteria</Text>
        <View style={styles.headRow}>
          <Text style={styles.cellWide}>Kriteria</Text>
          <Text style={styles.cell}>Jumlah nilai</Text>
          <Text style={styles.cell}>Rata-rata</Text>
        </View>
        {data.scores.length === 0 ? (
          <View style={styles.row}>
            <Text style={styles.cellWide}>Belum ada penilaian pada periode ini</Text>
          </View>
        ) : (
          data.scores.map((score) => (
            <View key={score.name} style={styles.row}>
              <Text style={styles.cellWide}>{score.name}</Text>
              <Text style={styles.cell}>{score.sessionsScored}</Text>
              <Text style={styles.cell}>{score.averageScore.toFixed(2)}</Text>
            </View>
          ))
        )}
        <View style={styles.row}>
          <Text style={styles.cellWide}>Nilai akhir</Text>
          <Text style={styles.cell}>{grade(data.finalGrade)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Catatan guru</Text>
        <Text style={styles.note}>{data.teacherNote ?? "—"}</Text>
        {/* Angka rapor dibekukan saat terbit, catatan guru masih boleh
            diperbaiki. Perbaikan itu DINYATAKAN di sini, bukan didiamkan:
            orang tua yang menyimpan PDF lama harus bisa tahu bahwa yang di
            tangannya bukan lagi teks terakhir. */}
        {data.teacherNoteUpdatedAt && (
          <Text style={styles.noteRevision}>
            {`Catatan guru diperbaiki ${formatTanggalWIB(data.teacherNoteUpdatedAt)}. Nilai dan kehadiran tidak berubah sejak diterbitkan.`}
          </Text>
        )}

        <Text style={styles.footer}>
          Diterbitkan {formatTanggalWIB(data.publishedAt)}
        </Text>
      </Page>
    </Document>
  );
}
