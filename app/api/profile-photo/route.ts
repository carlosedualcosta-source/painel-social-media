import { getDb } from "@/lib/db";
import { saveFile } from "@/lib/storage";

const sessionCookie = "sms_session";

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

async function currentUserId(request: Request): Promise<string | null> {
  const token = cookieValue(request, sessionCookie);
  if (!token) return null;
  const result = await getDb().execute({
    sql: "SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?",
    args: [token, Date.now()],
  });
  return (result.rows[0]?.user_id as string) ?? null;
}

export async function POST(request: Request) {
  try {
    const userId = await currentUserId(request);
    if (!userId) return Response.json({ error: "Login necessario." }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/")) {
      return Response.json({ error: "Envie uma imagem para o perfil." }, { status: 400 });
    }

    const key = `avatars/${userId}/${crypto.randomUUID()}-${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const blobUrl = await saveFile(key, buffer);

    await getDb().execute({
      sql: "UPDATE users SET avatar_url = ? WHERE id = ?",
      args: [blobUrl, userId],
    });

    return Response.json({ ok: true, avatarUrl: blobUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return Response.json({ error: message }, { status: 500 });
  }
}
