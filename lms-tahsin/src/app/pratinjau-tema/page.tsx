import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoleName } from "@/generated/prisma/enums";
import { Sidebar } from "@/components/layout/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const metadata: Metadata = {
  title: "Pratinjau tema",
  robots: { index: false, follow: false },
};

/**
 * KHUSUS DEVELOPMENT: pratinjau tampilan dashboard (brand v2, terang/gelap)
 * tanpa login dan tanpa data. Memakai komponen dan kelas teks yang sama
 * dengan halaman dashboard sungguhan (text-plum-*, Card, Button, dst.).
 * Di production halaman ini 404.
 */
export default function PratinjauTemaPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar roles={[RoleName.parent]} userName="Contoh Orang Tua" unreadCount={3} />
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="max-w-5xl space-y-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-plum-800">
              Assalamu’alaikum, Contoh
            </h1>
            <p className="mt-1 text-plum-500">
              Ringkasan bacaan anak Anda pekan ini. Data di halaman ini contoh.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { judul: "Sesi pekan ini", nilai: "3", ket: "dari 4 terjadwal" },
              { judul: "Nilai makhraj", nilai: "78", ket: "naik 6 dari pekan lalu" },
              { judul: "Tagihan", nilai: "Lunas", ket: "periode September" },
            ].map((k) => (
              <Card key={k.judul} size="sm">
                <CardHeader>
                  <CardDescription>{k.judul}</CardDescription>
                  <CardTitle className="text-3xl">{k.nilai}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-plum-500">{k.ket}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tombol dan lencana</CardTitle>
              <CardDescription>Semua varian komponen dasar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-3">
                <Button>Simpan jadwal</Button>
                <Button variant="outline">Batal</Button>
                <Button variant="secondary">Sekunder</Button>
                <Button variant="ghost">Hantu</Button>
                <Button variant="destructive">Hapus</Button>
                <Button variant="link">Tautan</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>Terjadwal</Badge>
                <Badge variant="secondary">Draf</Badge>
                <Badge variant="destructive">Terlambat</Badge>
                <Badge variant="outline">Privat</Badge>
              </div>
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                Contoh peringatan: belum ada nilai untuk murid ini.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Form</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nama">Nama anak</Label>
                <Input id="nama" placeholder="mis. Aisyah" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catatan">Catatan untuk guru</Label>
                <Textarea id="catatan" placeholder="Opsional" />
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="jadwal">
            <TabsList>
              <TabsTrigger value="jadwal">Jadwal</TabsTrigger>
              <TabsTrigger value="nilai">Nilai</TabsTrigger>
              <TabsTrigger value="catatan">Catatan</TabsTrigger>
            </TabsList>
            <TabsContent value="jadwal" className="mt-4">
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Guru</TableHead>
                      <TableHead>Materi</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      ["Sen, 29 Sep", "Ustadzah Contoh", "Makhraj halqi", "Hadir"],
                      ["Rab, 1 Okt", "Ustadzah Contoh", "Mad thabi'i", "Terjadwal"],
                      ["Jum, 3 Okt", "Ustadzah Contoh", "Qalqalah", "Terjadwal"],
                    ].map((b) => (
                      <TableRow key={b[0]}>
                        <TableCell className="font-medium text-plum-800">{b[0]}</TableCell>
                        <TableCell className="text-plum-600">{b[1]}</TableCell>
                        <TableCell className="text-plum-600">{b[2]}</TableCell>
                        <TableCell>
                          <Badge variant={b[3] === "Hadir" ? "default" : "secondary"}>{b[3]}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
