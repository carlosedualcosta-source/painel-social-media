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

function currentUserId(request: Request): string | null {
  const token = cookieValue(request, sessionCookie);
  if (!token) return null;
  const row = getDb()
    .prepare(
      "SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?"
    )
    .get(token, Date.now()) as { user_id: string } | undefined;
  return row?.user_id ?? null;
}

export async function POST(request: Request) {
  try {
    const userId = currentUserId(request);
    if (!userId)
      return Response.json({ error: "Login necessario." }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/")) {
      return Response.json(
        { error: "Envie uma imagem para o perfil." },
        { status: 400 }
      );
    }

    const key = `avatars/${userId}/${crypto.randomUUID()}-${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    saveFile(key, buffer);
    getDb()
      .prepare("UPDATE users SET avatar_key = ? WHERE id = ?")
      .run(key, userId);

    return Response.json({
      ok: true,
      avatarUrl: `/api/file?key=${encodeURIComponent(key)}`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro inesperado.";
    return Response.json({ error: message }, { status: 500 });
  }
}
