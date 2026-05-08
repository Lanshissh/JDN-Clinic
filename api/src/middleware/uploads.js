import crypto from "crypto";
import multer from "multer";

const DEFAULT_MAX_IMAGE_MB = 8;
const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/gif", "gif"],
  ["image/webp", "webp"],
]);

function maxImageBytes() {
  const configured = Number(process.env.MAX_IMAGE_UPLOAD_MB);
  const mb = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_IMAGE_MB;
  return Math.floor(mb * 1024 * 1024);
}

function uploadFileFilter(_req, file, callback) {
  if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
    const err = new Error("Only JPEG, PNG, GIF, or WebP images are allowed.");
    err.status = 400;
    return callback(err);
  }

  return callback(null, true);
}

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxImageBytes(),
    files: 10,
  },
  fileFilter: uploadFileFilter,
});

function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }

  const header6 = buffer.subarray(0, 6).toString("ascii");
  if (header6 === "GIF87a" || header6 === "GIF89a") {
    return { mime: "image/gif", ext: "gif" };
  }

  const riff = buffer.subarray(0, 4).toString("ascii");
  const webp = buffer.subarray(8, 12).toString("ascii");
  if (riff === "RIFF" && webp === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }

  return null;
}

export function validateUploadedImages(files) {
  const validated = [];

  for (const file of files ?? []) {
    const detected = detectImageType(file.buffer);
    if (!detected || detected.mime !== file.mimetype) {
      return {
        ok: false,
        error: "Uploaded files must be valid JPEG, PNG, GIF, or WebP images.",
      };
    }

    validated.push({ file, mime: detected.mime, ext: detected.ext });
  }

  return { ok: true, files: validated };
}

export function clinicImagesBucket() {
  return process.env.CLINIC_IMAGES_BUCKET || "clinic-images";
}

export function imageStoragePath(folder, recordId, ext) {
  return `${folder}/${recordId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
}
