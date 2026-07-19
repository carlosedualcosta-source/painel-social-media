import { put, del } from "@vercel/blob";

export async function saveFile(key: string, data: Buffer): Promise<string> {
  const blob = await put(key, data, { access: "public", addRandomSuffix: false });
  return blob.url;
}

export async function deleteFile(key: string): Promise<void> {
  try {
    await del(key);
  } catch {
    // ignore if file doesn't exist
  }
}
