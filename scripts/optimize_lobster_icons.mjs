import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const storageRoot = path.resolve(process.argv[2] || process.env.CLAWLODGE_STORAGE_DIR || path.join(process.cwd(), "data", "storage", "lobsters"));
const thumbSize = Number(process.argv[3] || process.env.CLAWLODGE_ICON_THUMB_SIZE || 52);
const renderSize = Number(process.argv[4] || process.env.CLAWLODGE_ICON_THUMB_RENDER_SIZE || 104);
const webpQuality = Number(process.env.CLAWLODGE_ICON_THUMB_WEBP_QUALITY || 95);

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
    if (/^icon\.png$/i.test(entry.name)) {
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

async function createThumb(filePath, size, targetSize) {
  const thumbPath = filePath.replace(/\.[^.]+$/i, `-${size}.webp`);
  const buffer = await sharp(filePath, { animated: false })
    .resize(targetSize, targetSize, {
      fit: "contain",
      position: "centre",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: false,
    })
    .webp({ quality: webpQuality, effort: 6, alphaQuality: 100 })
    .toBuffer();
  await fs.writeFile(thumbPath, buffer);
  await writeMeta(thumbPath, "image/webp");
  return { thumbPath, thumbBytes: buffer.length };
}

async function main() {
  const files = await walk(storageRoot);
  let thumbCount = 0;

  for (const filePath of files) {
    await createThumb(filePath, thumbSize, renderSize);
    thumbCount += 1;
  }

  console.log(
    JSON.stringify(
      {
        storageRoot,
        files: files.length,
        thumbCount,
        thumbSize,
        renderSize,
        webpQuality,
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
