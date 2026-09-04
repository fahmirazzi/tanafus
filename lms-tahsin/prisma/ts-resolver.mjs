import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC_DIR = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "src");

function firstExisting(base) {
  for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
    if (existsSync(candidate)) {
      return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
  }
  return null;
}

/**
 * Prisma meng-generate client TypeScript dengan import tanpa ekstensi
 * (contoh: `from "./enums"`), sedangkan resolver ESM Node mewajibkan
 * ekstensi eksplisit. Hook ini menambalnya khusus untuk script Node
 * (seed / maintenance). Next.js tidak memakai hook ini — bundler-nya
 * sudah menangani resolusi sendiri.
 */
export async function resolve(specifier, context, nextResolve) {
  const parent = context.parentURL;

  if (specifier.startsWith(".") && parent?.startsWith("file:")) {
    const hit = firstExisting(
      resolvePath(dirname(fileURLToPath(parent)), specifier),
    );
    if (hit) return hit;
  }

  // Alias "@/..." dari tsconfig, supaya script maintenance bisa memakai
  // modul aplikasi (mis. generator sesi) tanpa menyalin logikanya.
  if (specifier.startsWith("@/")) {
    const hit = firstExisting(resolvePath(SRC_DIR, specifier.slice(2)));
    if (hit) return hit;
  }

  return nextResolve(specifier, context);
}
