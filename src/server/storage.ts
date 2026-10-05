import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { put } from "@vercel/blob";

/*
 * Image storage for Insights (covers and inline images).
 *   production  → Vercel Blob (when BLOB_READ_WRITE_TOKEN is set)
 *   development → ./.uploads on disk, served by /uploads/[...path]
 * The serverless filesystem is read-only, so disk storage is dev-only.
 */

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const LOCAL_ROOT = path.join(process.cwd(), ".uploads");

/** File signatures, so a renamed file cannot pose as an image. */
function sniff(bytes: Uint8Array): string | null {
  const hex = (n: number) => Array.from(bytes.slice(0, n), (b) => b.toString(16).padStart(2, "0")).join("");
  if (hex(3) === "ffd8ff") return "image/jpeg";
  if (hex(8) === "89504e470d0a1a0a") return "image/png";
  if (hex(4) === "47494638") return "image/gif";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && /avif|avis/.test(ascii(8, 12))) return "image/avif";
  return null;
}

export class UploadError extends Error {}

export async function storeImage(file: File, folder: "insights"): Promise<{ url: string }> {
  if (file.size === 0) throw new UploadError("The file is empty.");
  if (file.size > MAX_IMAGE_BYTES) throw new UploadError("Images must be 4 MB or smaller.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type || !(type in IMAGE_TYPES)) throw new UploadError("Upload a JPEG, PNG, WebP, AVIF or GIF image.");

  const name = `${folder}/${randomUUID()}.${IMAGE_TYPES[type]}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(name, Buffer.from(bytes), { access: "public", contentType: type, addRandomSuffix: false });
    return { url: blob.url };
  }

  if (process.env.VERCEL) throw new UploadError("Image storage is not configured. Add a Vercel Blob store to this project.");

  const target = path.join(LOCAL_ROOT, name);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return { url: `/uploads/${name}` };
}

/** Reads a locally stored upload (development only). Returns null for anything outside the uploads folder. */
export async function readLocalUpload(segments: string[]): Promise<{ bytes: Buffer; type: string } | null> {
  if (segments.some((s) => !/^[A-Za-z0-9_.-]+$/.test(s) || s.startsWith("."))) return null;
  const target = path.join(LOCAL_ROOT, ...segments);
  if (!target.startsWith(LOCAL_ROOT + path.sep)) return null;
  const extension = path.extname(target).slice(1).toLowerCase();
  const type = Object.entries(IMAGE_TYPES).find(([, ext]) => ext === extension)?.[0];
  if (!type) return null;
  try {
    return { bytes: await readFile(target), type };
  } catch {
    return null;
  }
}
