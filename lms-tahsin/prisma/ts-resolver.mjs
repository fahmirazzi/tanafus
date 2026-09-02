import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
    const base = resolvePath(dirname(fileURLToPath(parent)), specifier);
    for (const candidate of [`${base}.ts`, `${base}/index.ts`]) {
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
  }
  return nextResolve(specifier, context);
}
