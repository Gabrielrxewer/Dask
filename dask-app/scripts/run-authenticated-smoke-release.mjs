import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vitestBin = path.join(rootDir, "node_modules", "vitest", "vitest.mjs");

const result = spawnSync(
  process.execPath,
  [
    vitestBin,
    "run",
    "src/test/smoke/authenticated-smoke.test.ts",
    "--reporter=verbose"
  ],
  {
    cwd: rootDir,
    env: {
      ...process.env,
      DASK_RELEASE_SMOKE: "1"
    },
    stdio: "inherit"
  }
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
