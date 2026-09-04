import { redirect } from "next/navigation";
import {
  assertCanAccess,
  ForbiddenError,
  type AccessResource,
  type SessionUser,
} from "@/lib/auth-guard";

/**
 * Versi halaman dari assertCanAccess.
 *
 * Di route handler, ForbiddenError ditangkap handleApiError dan menjadi
 * respons 403 yang rapi. Di server component tidak ada yang menangkapnya,
 * sehingga error yang sama akan muncul sebagai layar "server error" —
 * padahal yang terjadi bukan kerusakan, melainkan penolakan akses. Di sini
 * penolakan itu diarahkan ke halaman /403 yang sudah ada, sejalan dengan
 * cara middleware menangani ketidakcocokan role.
 */
export async function guardPageAccess(
  user: SessionUser,
  resource: AccessResource,
): Promise<void> {
  try {
    await assertCanAccess(user, resource);
  } catch (error) {
    // redirect() bekerja dengan melempar, jadi panggilannya sengaja berada
    // di luar blok try milik assertCanAccess agar tidak tertangkap sendiri.
    if (error instanceof ForbiddenError) redirect("/403");
    throw error;
  }
}
