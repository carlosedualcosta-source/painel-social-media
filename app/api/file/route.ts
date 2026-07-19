// This route is no longer needed — media is served directly from Vercel Blob URLs.
// Kept as a redirect fallback for any old references.
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return new Response("Arquivo nao informado.", { status: 400 });
  if (key.startsWith("http")) return Response.redirect(key, 302);
  return new Response("Arquivo nao encontrado.", { status: 404 });
}
