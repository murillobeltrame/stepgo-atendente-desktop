import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const buildDir = path.join(projectRoot, "build");
const brandDir = path.join(buildDir, "brand");
const publicDir = path.join(projectRoot, "public");
const siteRoot = path.join(projectRoot, "..", "stepgosistemassite");

const siteIconCandidates = [
  path.join(siteRoot, "src", "app", "icon.png"),
  path.join(siteRoot, "assets", "icon-mark-source.png"),
  path.join(siteRoot, "public", "icon.png"),
  path.join(siteRoot, "public", "logo.png"),
  path.join(brandDir, "icon-source.png"),
];

function resolveBrandSource() {
  for (const candidate of siteIconCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    "Ícone Nive não encontrado. Copie stepgosistemassite/src/app/icon.png para build/brand/icon-source.png.",
  );
}

async function renderSquarePng(source, size) {
  return sharp(source)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function writePng(source, size, output) {
  await sharp(await renderSquarePng(source, size)).toFile(output);
}

async function writeIco(source, outputPath, sizes) {
  const pngBuffers = await Promise.all(sizes.map((size) => renderSquarePng(source, size)));
  const images = await Promise.all(
    pngBuffers.map(async (buf, index) => {
      const meta = await sharp(buf).metadata();
      return {
        buf,
        width: meta.width ?? sizes[index],
        height: meta.height ?? sizes[index],
      };
    }),
  );

  const count = images.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const header = Buffer.alloc(headerSize);

  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const parts = [];
  images.forEach((img, index) => {
    const entryOffset = 6 + index * 16;
    header.writeUInt8(img.width >= 256 ? 0 : img.width, entryOffset);
    header.writeUInt8(img.height >= 256 ? 0 : img.height, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(img.buf.length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);
    offset += img.buf.length;
    parts.push(img.buf);
  });

  fs.writeFileSync(outputPath, Buffer.concat([header, ...parts]));
}

async function main() {
  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(brandDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });

  const source = resolveBrandSource();
  const iconSourcePath = path.join(brandDir, "icon-source.png");

  fs.copyFileSync(source, iconSourcePath);

  await writePng(source, 256, path.join(buildDir, "icon.png"));
  await writePng(source, 32, path.join(buildDir, "tray.png"));
  await writePng(source, 128, path.join(publicDir, "nive-icon.png"));
  await writeIco(source, path.join(brandDir, "favicon.ico"), [16, 32, 48, 256]);
  writeNotificationSound(path.join(buildDir, "notification.wav"));

  console.log(`Ícones Nive gerados a partir de: ${source}`);
}

function writeNotificationSound(outputPath) {
  const sampleRate = 44100;
  const tones = [
    { frequency: 880, duration: 0.1 },
    { frequency: 1175, duration: 0.14 },
  ];
  const gapSeconds = 0.05;
  const samples = [];

  for (const [index, tone] of tones.entries()) {
    const toneSamples = Math.floor(sampleRate * tone.duration);
    for (let i = 0; i < toneSamples; i += 1) {
      const t = i / sampleRate;
      const attack = Math.min(1, t * 60);
      const release = Math.exp((-10 * t) / tone.duration);
      samples.push(Math.sin(2 * Math.PI * tone.frequency * t) * attack * release * 0.35);
    }

    if (index < tones.length - 1) {
      const gapSamples = Math.floor(sampleRate * gapSeconds);
      for (let i = 0; i < gapSamples; i += 1) samples.push(0);
    }
  }

  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + index * 2);
  });

  fs.writeFileSync(outputPath, buffer);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
