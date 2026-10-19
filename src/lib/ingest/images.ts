import { createHash } from "node:crypto";
import { getSupabase, IMAGE_BUCKET } from "../supabase";
import { decodeEntities, fetchWithTimeout, mapLimit, normalizeUrl } from "./util";

const MAX_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/** For feeds without images: read the article page's og:image / twitter:image. */
export async function findOgImage(articleUrl: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(articleUrl, 8_000, { headers: { Accept: "text/html" } });
    if (!res.ok || !res.body) return null;
    // Only read the <head>; no need to download the whole article.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    while (html.length < 200_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    reader.cancel().catch(() => {});
    const meta =
      html.match(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]*>/i)?.[0] ?? "";
    const content = meta.match(/content=["']([^"']+)["']/i)?.[1];
    if (!content) return null;
    return normalizeUrl(new URL(decodeEntities(content), res.url).toString());
  } catch {
    return null;
  }
}

/**
 * Copies a publisher image into Supabase Storage so the feed doesn't depend on
 * hotlinking (some publishers expire or block those URLs). Returns the storage path.
 */
export async function mirrorImage(imageUrl: string, publishedAt: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(imageUrl, 10_000, { headers: { Accept: "image/avif,image/webp,image/*" } });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const ext = EXT[type];
    if (!ext) return null;
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES || bytes.byteLength < 1024) return null;

    const day = publishedAt.slice(0, 10); // YYYY-MM-DD, makes retention cleanup easy to eyeball
    const path = `${day}/${createHash("sha1").update(imageUrl).digest("hex")}.${ext}`;
    const { error } = await getSupabase()
      .storage.from(IMAGE_BUCKET)
      .upload(path, bytes, { contentType: type, upsert: true, cacheControl: "31536000" });
    return error ? null : path;
  } catch {
    return null;
  }
}

/** Fills missing images and mirrors them, stopping early if we run out of time. */
export async function processImages<T extends { url: string; image_url: string | null; published_at: string }>(
  items: T[],
  deadline: number,
): Promise<(T & { image_path: string | null })[]> {
  await mapLimit(
    items.filter((i) => !i.image_url),
    6,
    async (item) => {
      if (Date.now() > deadline) return;
      item.image_url = await findOgImage(item.url);
    },
  );

  return mapLimit(items, 8, async (item) => {
    const image_path = item.image_url && Date.now() < deadline ? await mirrorImage(item.image_url, item.published_at) : null;
    return { ...item, image_path };
  });
}

export async function deleteImages(paths: string[]) {
  const storage = getSupabase().storage.from(IMAGE_BUCKET);
  for (let i = 0; i < paths.length; i += 100) {
    await storage.remove(paths.slice(i, i + 100));
  }
}
