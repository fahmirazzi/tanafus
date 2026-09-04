/** "Ustadzah Khadijah" -> "UK". Dipakai sebagai pengganti foto profil. */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const picked = [parts[0], parts[parts.length - 1]].slice(
    0,
    parts.length === 1 ? 1 : 2,
  );
  return picked.map((p) => p[0]?.toUpperCase() ?? "").join("");
}
