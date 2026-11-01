import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { randomFromAlphabet } from './crypto';
import { env, isProd } from './env';
import { HttpError } from './http';

// Product image pipeline. Whatever is uploaded is decoded with sharp, resized, re-encoded as WebP and stripped of
// all metadata (EXIF, GPS, embedded profiles). Nothing from the original file is ever served back, so a file that
// only pretends to be an image (script, SVG, polyglot) cannot reach customers.
//
// Storage: Vercel Blob when BLOB_READ_WRITE_TOKEN is set. Without it, development writes to public/uploads.
// Production without a token refuses uploads instead of silently losing files.

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel functions accept at most about 4.5 MB per request
const MAX_PIXELS = 40_000_000;
const MIN_SIDE = 400;

export interface StoredImage {
  url: string; // 1600 px
  urlMd: string; // 800 px
  urlSm: string; // 400 px
  width: number;
  height: number;
}

/** Identifies the real format from the first bytes. Returns null for anything that is not JPEG, PNG or WebP. */
export function sniffImage(buf: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

export function storageMode(): 'blob' | 'local' | 'none' {
  if (env('BLOB_READ_WRITE_TOKEN')) return 'blob';
  return isProd ? 'none' : 'local';
}

async function putFile(name: string, data: Buffer): Promise<string> {
  const mode = storageMode();
  if (mode === 'blob') {
    const { put } = await import('@vercel/blob');
    const res = await put(`products/${name}`, data, {
      access: 'public',
      contentType: 'image/webp',
      addRandomSuffix: false,
      cacheControlMaxAge: 31_536_000,
      token: env('BLOB_READ_WRITE_TOKEN'),
    });
    return res.url;
  }
  if (mode === 'local') {
    const dir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), data);
    return `/uploads/${name}`;
  }
  throw new HttpError(503, 'storage_unavailable', 'Image storage is not set up. Add BLOB_READ_WRITE_TOKEN in your hosting settings.');
}

export async function storeProductImage(input: Buffer): Promise<StoredImage> {
  if (input.length === 0) throw new HttpError(422, 'invalid_image', 'That file is empty.');
  if (input.length > MAX_UPLOAD_BYTES) throw new HttpError(413, 'too_large', 'Each image must be 4 MB or smaller.');
  if (!sniffImage(input)) throw new HttpError(422, 'invalid_image', 'Upload a JPEG, PNG or WebP image.');

  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).metadata();
  } catch {
    throw new HttpError(422, 'invalid_image', 'This image could not be read. Try exporting it again.');
  }
  if (!meta.width || !meta.height) throw new HttpError(422, 'invalid_image', 'This image could not be read.');
  if (Math.min(meta.width, meta.height) < MIN_SIDE) {
    throw new HttpError(422, 'image_too_small', `Images must be at least ${MIN_SIDE} pixels on the shorter side.`);
  }

  const id = `${Date.now().toString(36)}-${randomFromAlphabet(12, 'abcdefghjkmnpqrstvwxyz23456789')}`;
  const render = async (width: number, quality: number) => {
    const { data, info } = await sharp(input, { limitInputPixels: MAX_PIXELS })
      .rotate() // honour the camera orientation before metadata is dropped
      .resize({ width, withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  };

  const [lg, md, sm] = await Promise.all([render(1600, 82), render(800, 80), render(400, 78)]);
  const [url, urlMd, urlSm] = await Promise.all([putFile(`${id}-1600.webp`, lg.data), putFile(`${id}-800.webp`, md.data), putFile(`${id}-400.webp`, sm.data)]);
  return { url, urlMd, urlSm, width: lg.width, height: lg.height };
}

/** Best effort removal of the three files for an image. Missing files are not an error. */
export async function removeStoredImage(urls: string[]): Promise<void> {
  const mode = storageMode();
  try {
    if (mode === 'blob') {
      const { del } = await import('@vercel/blob');
      await del(urls, { token: env('BLOB_READ_WRITE_TOKEN') });
    } else if (mode === 'local') {
      for (const u of urls) {
        if (!u.startsWith('/uploads/') || u.includes('..')) continue;
        await unlink(path.join(process.cwd(), 'public', u)).catch(() => undefined);
      }
    }
  } catch (err) {
    console.error('[storage] could not delete image files', (err as Error).message);
  }
}
