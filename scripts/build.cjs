const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function findTypeScriptBin() {
  try {
    return require.resolve("typescript/bin/tsc");
  } catch {
    // Workspace installs may live in the parent pnpm store.
  }

  const pnpmRoot = path.resolve(__dirname, "..", "..", "node_modules", ".pnpm");
  if (!fs.existsSync(pnpmRoot)) return undefined;

  return fs
    .readdirSync(pnpmRoot)
    .filter((name) => name.startsWith("typescript@"))
    .map((name) => path.join(pnpmRoot, name, "node_modules", "typescript", "bin", "tsc"))
    .find((candidate) => fs.existsSync(candidate));
}

const tsc = findTypeScriptBin();
if (!tsc) {
  console.error("Could not find TypeScript. Install dependencies before building sketchmark.");
  process.exit(1);
}

const result = spawnSync(process.execPath, [tsc, "-p", "tsconfig.json"], {
  cwd: path.resolve(__dirname, ".."),
  stdio: "inherit"
});

process.exit(result.status ?? 1);
