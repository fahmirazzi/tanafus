"use client";

/** Umpan balik form yang dipakai semua modul: pesan per field dan alert form. */

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  );
}

/** Konfirmasi singkat setelah aksi berhasil. */
export function FormNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-md bg-orange-50 px-3 py-2 text-sm text-plum-700">
      {message}
    </p>
  );
}
