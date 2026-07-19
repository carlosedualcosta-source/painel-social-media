import { getDb } from "@/lib/db";
import JSZip from "jszip";

const sessionCookie = "sms_session";

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

async function currentUser(request: Request) {
  const token = cookieValue(request, sessionCookie);
  if (!token) return null;
  const result = await getDb().execute({
    sql: "SELECT users.id, users.role FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ? AND sessions.expires_at > ?",
    args: [token, Date.now()],
  });
  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as { id: string; role: string };
}

function sanitize(name: string) {
  return name.replace(/[<>:"/\\|?*]+/g, "_").trim();
}

function ext(url: string, fallbackType: string) {
  const match = url.match(/\.(\w{2,5})(?:\?|$)/);
  if (match) return match[1].toLowerCase();
  return fallbackType === "video" ? "mp4" : "jpg";
}

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    if (!user || !["admin", "gestor"].includes(user.role)) {
      return Response.json({ error: "Sem permissão." }, { status: 403 });
    }

    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId) return Response.json({ error: "projectId obrigatório." }, { status: 400 });

    const db = getDb();
    const project = (await db.execute({ sql: "SELECT * FROM projects WHERE id = ?", args: [projectId] })).rows[0];
    if (!project) return Response.json({ error: "Projeto não encontrado." }, { status: 404 });

    const posts = (await db.execute({ sql: "SELECT * FROM posts WHERE project_id = ? ORDER BY number", args: [projectId] })).rows;
    const formats = (await db.execute("SELECT * FROM post_formats")).rows;
    const mediaRows = (await db.execute("SELECT * FROM media ORDER BY created_at")).rows;

    const zip = new JSZip();
    const folderName = sanitize(project.name as string);

    for (const post of posts) {
      const num = String(post.number).padStart(2, "0");
      const postFolder = `${folderName}/Post ${num}`;

      const postFormats = formats.filter((f) => f.post_id === post.id);
      for (const fmt of postFormats) {
        const fmtMedia = mediaRows.filter((m) => m.format_id === fmt.id);
        const isCarousel = fmtMedia.length > 1;

        for (let i = 0; i < fmtMedia.length; i++) {
          const m = fmtMedia[i];
          const mediaUrl = m.url as string;
          if (!mediaUrl) continue;

          try {
            const res = await fetch(mediaUrl);
            if (!res.ok) continue;
            const buffer = await res.arrayBuffer();
            const extension = ext(mediaUrl, m.type as string);
            const fileName = isCarousel
              ? `Post ${num}_${String(i + 1).padStart(2, "0")}.${extension}`
              : `Post ${num}.${extension}`;
            zip.file(`${postFolder}/${fileName}`, buffer);
          } catch {
            continue;
          }
        }
      }
    }

    const content = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });

    return new Response(content, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${sanitize(project.name as string)}.zip"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return Response.json({ error: message }, { status: 500 });
  }
}
