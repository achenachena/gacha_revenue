import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

// Packages Sites metadata and migrations after Vite finishes compiling.
export function sites(): Plugin {
  let root = process.cwd();

  return {
    name: "sites",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    async closeBundle() {
      const outputDirectory = resolve(root, "dist", ".openai");
      const hostingConfig = resolve(root, ".openai", "hosting.json");
      const drizzleSource = resolve(root, "drizzle");

      await rm(outputDirectory, { recursive: true, force: true });
      await mkdir(outputDirectory, { recursive: true });

      if (await exists(hostingConfig)) {
        await cp(hostingConfig, resolve(outputDirectory, "hosting.json"));
      }
      if (await exists(drizzleSource)) {
        await cp(drizzleSource, resolve(outputDirectory, "drizzle"), {
          recursive: true,
        });
      }

      // The hosting runtime rejects an explicit/empty compatibility flag list
      // once its current compatibility date supplies the defaults. Cloudflare's
      // Vite plugin always emits the empty array, so omit that no-op key from
      // the deployable metadata instead of letting the host merge a stale flag.
      const workerConfigPath = resolve(root, "dist", "server", "wrangler.json");
      if (await exists(workerConfigPath)) {
        const workerConfig = JSON.parse(await readFile(workerConfigPath, "utf8")) as Record<string, unknown>;
        if (Array.isArray(workerConfig.compatibility_flags) && workerConfig.compatibility_flags.length === 0) {
          delete workerConfig.compatibility_flags;
          await writeFile(workerConfigPath, JSON.stringify(workerConfig));
        }
      }
    },
  };
}
