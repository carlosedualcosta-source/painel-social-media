import { getDb } from "@/lib/db";
import { saveFile } from "@/lib/storage";

const sessionCookie = "sms_session";

type PublicUser = {
  id: string;
  role: "admin" | "gestor" | "cliente";
  clientId: string | null;
};

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function canManage(user: PublicUser) {
  return user.role === "admin" || user.role === "gestor";
}

function safeFileName(name: string) {
  return (
    name.replace(/[^\w.\-]+/g, "-").replace(/-+/g, "-").slice(0, 120) ||
    "arquivo"
  );
}

function mediaKind(file: File): "image" | "video" | null {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (
    type.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i.test(name)
  )
    return "image";
  if (
    type.startsWith("video/") ||
    /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(name)
  )
    return "video";
  return null;
}

function currentUser(request: Request): PublicUser | null {
  const token = cookieValue(request, sessionCookie);
  if (!token) return null;
  const row = getDb()
    .prepare(
      "SELECT users.id, users.role, users.client_id as clientId FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ? AND sessions.expires_at > ?"
    )
    .get(token, Date.now()) as PublicUser | undefined;
  return row ?? null;
}

function formatClientId(formatId: string): string | null {
  const row = getDb()
    .prepare(
      "SELECT projects.client_id as client_id FROM post_formats JOIN posts ON posts.id = post_formats.post_id JOIN projects ON projects.id = posts.project_id WHERE post_formats.id = ?"
    )
    .get(formatId) as { client_id: string } | undefined;
  return row?.client_id ?? null;
}

export async function POST(request: Request) {
  try {
    const user = currentUser(request);
    if (!user || !canManage(user)) {
      return Response.json(
        { error: "Sem permissao para subir arquivos." },
        { status: 403 }
      );
    }

    const form = await request.formData();
    const formatId = String(form.get("formatId") ?? "");
    const clientId = formatClientId(formatId);
    if (!clientId)
      return Response.json(
        { error: "Formato nao encontrado." },
        { status: 404 }
      );

    const files = form.getAll("files").filter(
      (item): item is File =>
        typeof item === "object" && "name" in item && "arrayBuffer" in item
    );
    if (files.length === 0)
      return Response.json(
        { error: "Envie ao menos um arquivo." },
        { status: 400 }
      );

    const db = getDb();
    const created: string[] = [];

    for (const file of files) {
      const kind = mediaKind(file);
      if (!kind) continue;
      const mediaId = `media_${crypto.randomUUID().replaceAll("-", "")}`;
      const key = `${clientId}/${formatId}/${mediaId}-${safeFileName(file.name)}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      saveFile(key, buffer);
      db.prepare(
        "INSERT INTO media (id, format_id, name, type, r2_key) VALUES (?, ?, ?, ?, ?)"
      ).run(mediaId, formatId, file.name, kind, key);
      db.prepare("UPDATE post_formats SET status = ? WHERE id = ?").run(
        "em_revisao",
        formatId
      );
      created.push(mediaId);
    }

    if (created.length === 0) {
      return Response.json(
        { error: "Nenhuma midia valida foi encontrada. Use imagem ou video." },
        { status: 400 }
      );
    }

    return Response.json({ ok: true, created });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro inesperado.";
    return Response.json({ error: message }, { status: 500 });
  }
}
