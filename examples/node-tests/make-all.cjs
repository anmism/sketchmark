const path = require("node:path");
const { spawnSync } = require("node:child_process");

const scripts = [
  "01-basic-2d.cjs",
  "02-animated-follow-2d.cjs",
  "03-builder-flow-2d.cjs",
  "04-effects-image-mask-2d.cjs",
  "05-sequence-2d.cjs",
  "06-structured-3d.cjs",
  "07-deck.cjs",
  "08-kernel-inspection.cjs"
];

for (const script of scripts) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
    stdio: "inherit",
    cwd: path.resolve(__dirname, "../..")
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log("All Node test examples generated in examples/node-tests/generated");
