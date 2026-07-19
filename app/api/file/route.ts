import { readFile } from "@/lib/storage";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return new Response("Arquivo nao informado.", { status: 400 });

  const file = readFile(key);
  if (!file) return new Response("Arquivo nao encontrado.", { status: 404 });

  return new Response(file.data, {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
