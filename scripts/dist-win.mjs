import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const target = process.argv.includes("--portable") ? "portable" : "nsis";

function rmSafe(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (error) {
    console.warn(`Não foi possível remover ${dir}:`, error);
  }
}

// Build fora do OneDrive — evita EPERM/EBUSY durante o empacotamento.
const outputDir = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
  "stepgo-atendente-desktop",
  "release",
);

rmSafe(outputDir);
fs.mkdirSync(outputDir, { recursive: true });

console.log(`Gerando instalador em: ${outputDir}`);

const builderArgs = [
  "electron-builder",
  "--win",
  target === "portable" ? "portable" : "",
  `--config.directories.output=${outputDir}`,
]
  .filter(Boolean)
  .join(" ");

execSync(builderArgs, {
  cwd: projectRoot,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    ELECTRON_BUILDER_CACHE: path.join(
      process.env.LOCALAPPDATA || os.tmpdir(),
      "electron-builder-cache",
    ),
  },
});

console.log("\nBuild concluído.");
console.log(`Instalador disponível em:\n${outputDir}`);
