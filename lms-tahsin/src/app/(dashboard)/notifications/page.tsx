import type { Metadata } from "next";
import { hasRole, requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { formatTanggalJamWIB } from "@/lib/datetime";
import { RoleName } from "@/generated/prisma/enums";
import {
  NotificationList,
  type NotificationItem,
} from "./notification-list";

export const metadata: Metadata = { title: "Notifikasi" };

/** Notifikasi terbaru yang ditampilkan; sisanya sudah bukan kabar baru. */
const PAGE_SIZE = 50;

/**
 * Pusat notifikasi in-app (roadmap item 20).
 *
 * Semua peran memakai halaman yang sama; isinya dibatasi userId dari sesi
 * login, jadi tidak ada satu pun jalur yang menampilkan notifikasi milik
 * orang lain (BR-10.1).
 */
export default async function NotificationsPage() {
  const user = await requireAuth();

  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        title: true,
        body: true,
        data: true,
        readAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  // Hanya orang tua dan murid yang punya halaman progres; guru dikirim ke
  // detail sesi. Tautan dibuat di server karena hanya di sini peran
  // penggunanya diketahui.
  const isFamily = hasRole(user, RoleName.parent, RoleName.student);

  const items: NotificationItem[] = rows.map((row) => {
    const data = (row.data ?? {}) as {
      sessionId?: unknown;
      studentId?: unknown;
    };
    const studentId =
      typeof data.studentId === "string" ? data.studentId : null;
    const sessionId =
      typeof data.sessionId === "string" ? data.sessionId : null;

    const href = isFamily
      ? studentId
        ? `/parent/progress/${studentId}`
        : null
      : sessionId
        ? `/teacher/sessions/${sessionId}`
        : null;

    return {
      id: row.id,
      title: row.title,
      body: row.body,
      createdAtLabel: formatTanggalJamWIB(row.createdAt),
      isRead: row.readAt !== null,
      href,
    };
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Notifikasi
        </h1>
        <p className="text-sm text-plum-500">
          Kabar sesi, feedback, dan pengajuan yang butuh perhatian Anda.
        </p>
      </div>

      <NotificationList items={items} unreadCount={unreadCount} />
    </div>
  );
}
