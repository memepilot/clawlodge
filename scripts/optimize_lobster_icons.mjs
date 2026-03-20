import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const storageRoot = path.resolve(process.argv[2] || process.env.CLAWLODGE_STORAGE_DIR || path.join(process.cwd(), "data", "storage", "lobsters"));
const thumbSize = Number(process.argv[3] || process.env.CLAWLODGE_ICON_THUMB_SIZE || 52);

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (/^icon\.(png|jpg|jpeg|webp|svg)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function metaPath(filePath) {
  return `${filePath}.meta.json`;
}

async function writeMeta(filePath, contentType) {
  await fs.writeFile(metaPath(filePath), JSON.stringify({ contentType }, null, 2), "utf8");
}

async function optimizeOriginal(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".svg") {
    return false;
  }

  const input = await fs.readFile(filePath);
  const image = sharp(input, { animated: false }).rotate();
  const metadata = await image.metadata();
  const optimized = await image
    .png({
      compressionLevel: 9,
      palette: true,
      effort: 10,
      quality: 90,
    })
    .toBuffer();

  if (optimized.length >= input.length && ext === ".png") {
    return false;
  }

  const targetPath = filePath.replace(/\.(jpg|jpeg|webp)$/i, ".png");
  await fs.writeFile(targetPath, optimized);
  await writeMeta(targetPath, "image/png");
  if (targetPath !== filePath) {
    await fs.rm(filePath, { force: true });
    await fs.rm(metaPath(filePath), { force: true });
  }
  return {
    originalBytes: input.length,
    optimizedBytes: optimized.length,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    targetPath,
  };
}

async function createThumb(filePath, size) {
  const thumbPath = filePath.replace(/\.[^.]+$/i, `-${size}.webp`);
  const buffer = await sharp(filePath, { animated: false })
    .resize(size, size, {
      fit: "contain",
      position: "centre",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: false,
    })
    .webp({ quality: 82, effort: 6, alphaQuality: 90 })
    .toBuffer();
  await fs.writeFile(thumbPath, buffer);
  await writeMeta(thumbPath, "image/webp");
  return { thumbPath, thumbBytes: buffer.length };
}

async function main() {
  const files = await walk(storageRoot);
  let optimizedCount = 0;
  let thumbCount = 0;
  let savedBytes = 0;

  for (const filePath of files) {
    const original = await optimizeOriginal(filePath);
    const currentPath = typeof original === "object" ? original.targetPath : filePath;
    if (original) {
      optimizedCount += 1;
      savedBytes += original.originalBytes - original.optimizedBytes;
    }
    await createThumb(currentPath, thumbSize);
    thumbCount += 1;
  }

  console.log(
    JSON.stringify(
      {
        storageRoot,
        files: files.length,
        optimizedCount,
        thumbCount,
        thumbSize,
        savedBytes,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
