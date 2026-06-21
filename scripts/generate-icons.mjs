import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const buildDir = path.join(projectRoot, "build");
const brandDir = path.join(buildDir, "brand");
const publicDir = path.join(projectRoot, "public");

const siteIconCandidates = [
  path.join(projectRoot, "..", "stepgosistemassite", "src", "app", "icon.png"),
  path.join(projectRoot, "..", "stepgosistemassite", "public", "logo.png"),
  path.join(brandDir, "icon-source.png"),
];

function resolveBrandSource() {
  for (const candidate of siteIconCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    "Ícone StepGo não encontrado. Copie stepgosistemassite/src/app/icon.png para build/brand/icon-source.png.",
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

  if (!fs.existsSync(path.join(brandDir, "icon-source.png"))) {
    fs.copyFileSync(source, path.join(brandDir, "icon-source.png"));
  }

  await writePng(source, 256, path.join(buildDir, "icon.png"));
  await writePng(source, 32, path.join(buildDir, "tray.png"));
  await writePng(source, 128, path.join(publicDir, "stepgo-icon.png"));
  await writeIco(source, path.join(brandDir, "favicon.ico"), [16, 32, 48, 256]);

  console.log(`Ícones StepGo gerados a partir de: ${source}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
