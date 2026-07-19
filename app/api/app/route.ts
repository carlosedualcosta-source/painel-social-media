import { createHash } from "crypto";
import { getDb } from "@/lib/db";
import type { InStatement } from "@libsql/client";

type Role = "admin" | "gestor" | "cliente";
type FormatKey = "feed" | "story" | "video";

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  client_id: string | null;
  avatar_url: string | null;
};

type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  clientId: string | null;
  avatarUrl: string | null;
};

const sessionCookie = "sms_session";
const formats: FormatKey[] = ["feed", "story", "video"];

function genId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function hashPassword(password: string): string {
  return createHash("sha256")
    .update(`social-media-panel:${password}`)
    .digest("hex");
}

function publicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    clientId: user.client_id,
    avatarUrl: user.avatar_url ?? null,
  };
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function cookieHeader(request: Request, token: string, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${sessionCookie}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function canManage(user: PublicUser) {
  return user.role === "admin" || user.role === "gestor";
}

function canAccessClient(user: PublicUser, clientId: string) {
  return canManage(user) || user.clientId === clientId;
}

async function ensureDb() {
  const db = getDb();

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tag TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      client_id TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      period TEXT NOT NULL,
      post_count INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      number INTEGER NOT NULL,
      title TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS post_formats (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      format TEXT NOT NULL,
      status TEXT NOT NULL,
      copy TEXT NOT NULL DEFAULT '',
      copy_notes TEXT NOT NULL DEFAULT '',
      team_notes TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      format_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT NOT NULL DEFAULT '',
      image_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      format_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      link_project_id TEXT,
      link_post_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const count = await db.execute("SELECT COUNT(*) as count FROM users");
  if (Number(count.rows[0].count) > 0) return;

  const client1 = "cliente-01";
  const client2 = "cliente-02";

  const batch: InStatement[] = [
    { sql: "INSERT INTO clients (id, name, tag) VALUES (?, ?, ?)", args: [client1, "Cliente 01", "fast-acai"] },
    { sql: "INSERT INTO clients (id, name, tag) VALUES (?, ?, ?)", args: [client2, "Cliente 02", "studio-nova"] },
    { sql: "INSERT INTO users (id, name, email, password_hash, role, client_id) VALUES (?, ?, ?, ?, ?, ?)", args: ["u-admin", "Administrador", "admin@painel.com", hashPassword("admin123"), "admin", null] },
    { sql: "INSERT INTO users (id, name, email, password_hash, role, client_id) VALUES (?, ?, ?, ?, ?, ?)", args: ["u-gestor", "Gestor Social", "gestor@painel.com", hashPassword("gestor123"), "gestor", null] },
    { sql: "INSERT INTO users (id, name, email, password_hash, role, client_id) VALUES (?, ?, ?, ?, ?, ?)", args: ["u-cliente-01", "Cliente 01", "cliente01@painel.com", hashPassword("cliente123"), "cliente", client1] },
    { sql: "INSERT INTO users (id, name, email, password_hash, role, client_id) VALUES (?, ?, ?, ?, ?, ?)", args: ["u-cliente-02", "Cliente 02", "cliente02@painel.com", hashPassword("cliente123"), "cliente", client2] },
  ];
  await db.batch(batch, "write");

  await createProjectRows({ clientId: client1, name: "Rede social Junho", period: "Junho 2026", postCount: 16 });
  await createProjectRows({ clientId: client1, name: "Rede social Julho", period: "Julho 2026", postCount: 12 });
  await createProjectRows({ clientId: client2, name: "Campanha Junho", period: "Junho 2026", postCount: 8 });
}

async function createProjectRows({ clientId, name, period, postCount }: { clientId: string; name: string; period: string; postCount: number }) {
  const db = getDb();
  const projectId = genId("project");

  const stmts: InStatement[] = [
    { sql: "INSERT INTO projects (id, client_id, name, period, post_count) VALUES (?, ?, ?, ?, ?)", args: [projectId, clientId, name, period, postCount] },
  ];

  for (let number = 1; number <= postCount; number += 1) {
    const postId = genId("post");
    stmts.push({ sql: "INSERT INTO posts (id, project_id, number, title) VALUES (?, ?, ?, ?)", args: [postId, projectId, number, `Post ${String(number).padStart(2, "0")}`] });
    for (const format of formats) {
      stmts.push({ sql: "INSERT INTO post_formats (id, post_id, format, status) VALUES (?, ?, ?, ?)", args: [genId("format"), postId, format, "rascunho"] });
    }
  }

  await db.batch(stmts, "write");
  return projectId;
}

async function createPostRows(projectId: string, number: number) {
  const db = getDb();
  const postId = genId("post");
  const stmts: InStatement[] = [
    { sql: "INSERT INTO posts (id, project_id, number, title) VALUES (?, ?, ?, ?)", args: [postId, projectId, number, `Post ${String(number).padStart(2, "0")}`] },
  ];
  for (const format of formats) {
    stmts.push({ sql: "INSERT INTO post_formats (id, post_id, format, status) VALUES (?, ?, ?, ?)", args: [genId("format"), postId, format, "rascunho"] });
  }
  await db.batch(stmts, "write");
  return postId;
}

async function currentUser(request: Request): Promise<PublicUser | null> {
  const token = cookieValue(request, sessionCookie);
  if (!token) return null;
  const now = Date.now();
  const result = await getDb().execute({
    sql: "SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ? AND sessions.expires_at > ?",
    args: [token, now],
  });
  if (result.rows.length === 0) return null;
  return publicUser(result.rows[0] as unknown as UserRow);
}

async function loadAppData(user: PublicUser | null) {
  if (!user) return { user: null, clients: [], users: [], projects: [], notifications: [] };

  const db = getDb();

  const clientsResult = canManage(user)
    ? await db.execute("SELECT * FROM clients ORDER BY name")
    : await db.execute({ sql: "SELECT * FROM clients WHERE id = ?", args: [user.clientId] });
  const clients = clientsResult.rows;

  let users: unknown[] = [];
  if (canManage(user)) {
    const usersResult = await db.execute("SELECT id, name, email, password, role, client_id as clientId, avatar_url as avatarUrl FROM users ORDER BY created_at DESC");
    users = usersResult.rows;
  }

  const projectsResult = canManage(user)
    ? await db.execute("SELECT * FROM projects ORDER BY created_at DESC")
    : await db.execute({ sql: "SELECT * FROM projects WHERE client_id = ? ORDER BY created_at DESC", args: [user.clientId] });

  const postRows = (await db.execute("SELECT * FROM posts ORDER BY number")).rows;
  const formatRows = (await db.execute("SELECT * FROM post_formats")).rows;
  const mediaRows = (await db.execute("SELECT * FROM media ORDER BY created_at")).rows;
  const commentRows = (await db.execute("SELECT comments.*, users.name as author, users.role as role FROM comments JOIN users ON users.id = comments.user_id ORDER BY comments.created_at")).rows;

  const notifications = await loadNotifications(user.id);

  return {
    user,
    clients,
    users,
    notifications,
    projects: projectsResult.rows.map((project) => {
      const projectPosts = postRows.filter((post) => post.project_id === project.id);
      return {
        id: project.id,
        clientId: project.client_id,
        name: project.name,
        period: project.period,
        postCount: project.post_count,
        posts: projectPosts.map((post) => {
          const fmtEntries = formats.map((format) => {
            const item = formatRows.find((row) => row.post_id === post.id && row.format === format);
            const fmtMedia = mediaRows.filter((m) => m.format_id === item?.id).map((m) => ({
              id: m.id, name: m.name, type: m.type, url: m.url, imageNotes: m.image_notes,
            }));
            const fmtComments = commentRows.filter((c) => c.format_id === item?.id).map((c) => ({
              id: c.id, author: c.author, role: c.role, text: c.text, createdAt: c.created_at,
            }));
            return [format, {
              id: item?.id, status: item?.status ?? "rascunho",
              copy: item?.copy ?? "", copyNotes: item?.copy_notes ?? "", teamNotes: item?.team_notes ?? "",
              media: fmtMedia, comments: fmtComments,
            }];
          });
          return { id: post.id, number: post.number, title: post.title, formats: Object.fromEntries(fmtEntries) };
        }),
      };
    }),
  };
}

async function formatClientId(formatId: string): Promise<string | null> {
  const result = await getDb().execute({
    sql: "SELECT projects.client_id as client_id FROM post_formats JOIN posts ON posts.id = post_formats.post_id JOIN projects ON projects.id = posts.project_id WHERE post_formats.id = ?",
    args: [formatId],
  });
  return (result.rows[0]?.client_id as string) ?? null;
}

async function notify(userIds: string[], type: string, title: string, body: string, linkProjectId?: string, linkPostId?: string) {
  const db = getDb();
  const stmts: InStatement[] = userIds.map((uid) => ({
    sql: "INSERT INTO notifications (id, user_id, type, title, body, link_project_id, link_post_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [genId("notif"), uid, type, title, body, linkProjectId ?? null, linkPostId ?? null],
  }));
  if (stmts.length > 0) await db.batch(stmts, "write");
}

async function getUsersForClient(clientId: string): Promise<string[]> {
  const rows = (await getDb().execute({ sql: "SELECT id FROM users WHERE client_id = ?", args: [clientId] })).rows;
  return rows.map((r) => r.id as string);
}

async function getManagerIds(): Promise<string[]> {
  const rows = (await getDb().execute("SELECT id FROM users WHERE role IN ('admin', 'gestor')")).rows;
  return rows.map((r) => r.id as string);
}

async function loadNotifications(userId: string) {
  const rows = (await getDb().execute({
    sql: "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    args: [userId],
  })).rows;
  return rows.map((r) => ({
    id: r.id, type: r.type, title: r.title, body: r.body,
    projectId: r.link_project_id, postId: r.link_post_id,
    isRead: r.is_read === 1, createdAt: r.created_at,
  }));
}

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export async function GET(request: Request) {
  try {
    await ensureDb();
    const user = await currentUser(request);
    return json(await loadAppData(user));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDb();
    const payload = (await request.json()) as Record<string, unknown>;
    const action = payload.action;
    const db = getDb();

    if (action === "login") {
      const email = String(payload.email ?? "").trim().toLowerCase();
      const password = String(payload.password ?? "");
      const result = await db.execute({ sql: "SELECT * FROM users WHERE lower(email) = ?", args: [email] });
      const row = result.rows[0] as unknown as UserRow | undefined;
      if (!row || row.password_hash !== hashPassword(password)) {
        return json({ error: "Email ou senha inválidos." }, { status: 401 });
      }
      const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      await db.execute({ sql: "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", args: [token, row.id, Date.now() + 1000 * 60 * 60 * 24 * 30] });
      return json(await loadAppData(publicUser(row)), {
        headers: { "Set-Cookie": cookieHeader(request, token, 60 * 60 * 24 * 30) },
      });
    }

    if (action === "logout") {
      const token = cookieValue(request, sessionCookie);
      if (token) await db.execute({ sql: "DELETE FROM sessions WHERE token = ?", args: [token] });
      return json({ ok: true }, { headers: { "Set-Cookie": cookieHeader(request, "", 0) } });
    }

    const user = await currentUser(request);
    if (!user) return json({ error: "Login necessário." }, { status: 401 });

    if (action === "createUser") {
      if (!canManage(user)) return json({ error: "Sem permissão." }, { status: 403 });
      const name = String(payload.name ?? "").trim();
      const email = String(payload.email ?? "").trim().toLowerCase();
      const password = String(payload.password ?? "");
      const role = String(payload.role ?? "cliente") as Role;
      const clientId = role === "cliente" ? String(payload.clientId ?? "") : null;
      if (!name || !email || !password || !["admin", "gestor", "cliente"].includes(role)) {
        return json({ error: "Preencha nome, email, senha e cargo." }, { status: 400 });
      }
      await db.execute({ sql: "INSERT INTO users (id, name, email, password_hash, role, client_id) VALUES (?, ?, ?, ?, ?, ?)", args: [genId("user"), name, email, hashPassword(password), role, clientId] });
      return json(await loadAppData(user));
    }

    if (action === "updateUser") {
      if (!canManage(user)) return json({ error: "Sem permissão." }, { status: 403 });
      const userId = String(payload.userId ?? "");
      const name = String(payload.name ?? "").trim();
      const email = String(payload.email ?? "").trim().toLowerCase();
      const role = String(payload.role ?? "cliente") as Role;
      const clientId = role === "cliente" ? String(payload.clientId ?? "") : null;
      if (!name || !email || !["admin", "gestor", "cliente"].includes(role))
        return json({ error: "Preencha nome, email e cargo." }, { status: 400 });
      const password = String(payload.password ?? "").trim();
      if (password) {
        await db.execute({ sql: "UPDATE users SET name = ?, email = ?, password_hash = ?, role = ?, client_id = ? WHERE id = ?", args: [name, email, hashPassword(password), role, clientId, userId] });
      } else {
        await db.execute({ sql: "UPDATE users SET name = ?, email = ?, role = ?, client_id = ? WHERE id = ?", args: [name, email, role, clientId, userId] });
      }
      return json(await loadAppData(user));
    }

    if (action === "deleteUser") {
      if (!canManage(user)) return json({ error: "Sem permissão." }, { status: 403 });
      const userId = String(payload.userId ?? "");
      if (userId === user.id) return json({ error: "Você não pode apagar seu próprio usuário." }, { status: 400 });
      await db.batch([
        { sql: "DELETE FROM sessions WHERE user_id = ?", args: [userId] },
        { sql: "DELETE FROM users WHERE id = ?", args: [userId] },
      ], "write");
      return json(await loadAppData(user));
    }

    if (action === "createClient") {
      if (!canManage(user)) return json({ error: "Sem permissão." }, { status: 403 });
      const name = String(payload.name ?? "").trim();
      const tag = String(payload.tag ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (!name) return json({ error: "Informe o nome do cliente." }, { status: 400 });
      await db.execute({ sql: "INSERT INTO clients (id, name, tag) VALUES (?, ?, ?)", args: [genId("client"), name, tag || name.toLowerCase().replace(/[^a-z0-9]+/g, "-")] });
      return json(await loadAppData(user));
    }

    if (action === "createProject") {
      if (!canManage(user)) return json({ error: "Sem permissão." }, { status: 403 });
      const name = String(payload.name ?? "").trim();
      const period = String(payload.period ?? name).trim();
      const clientId = String(payload.clientId ?? "");
      const postCount = Math.max(1, Math.min(120, Number(payload.postCount ?? 1)));
      if (!name || !clientId) return json({ error: "Informe nome e cliente." }, { status: 400 });
      await createProjectRows({ clientId, name, period, postCount });
      return json(await loadAppData(user));
    }

    if (action === "createPost") {
      if (!canManage(user)) return json({ error: "Sem permissão." }, { status: 403 });
      const projectId = String(payload.projectId ?? "");
      const projectResult = await db.execute({ sql: "SELECT * FROM projects WHERE id = ?", args: [projectId] });
      if (projectResult.rows.length === 0) return json({ error: "Projeto não encontrado." }, { status: 404 });
      const maxResult = await db.execute({ sql: "SELECT MAX(number) as max_number FROM posts WHERE project_id = ?", args: [projectId] });
      const nextNumber = (Number(maxResult.rows[0]?.max_number) || 0) + 1;
      const postId = await createPostRows(projectId, nextNumber);
      await db.execute({ sql: "UPDATE projects SET post_count = post_count + 1 WHERE id = ?", args: [projectId] });
      return json({ ...(await loadAppData(user)), createdPostId: postId });
    }

    if (action === "deletePost") {
      if (!canManage(user)) return json({ error: "Sem permissão." }, { status: 403 });
      const postId = String(payload.postId ?? "");
      const postResult = await db.execute({ sql: "SELECT project_id FROM posts WHERE id = ?", args: [postId] });
      if (postResult.rows.length === 0) return json({ error: "Post não encontrado." }, { status: 404 });
      const projectId = postResult.rows[0].project_id as string;
      const fmtResult = await db.execute({ sql: "SELECT id FROM post_formats WHERE post_id = ?", args: [postId] });
      const stmts: InStatement[] = [];
      for (const fmt of fmtResult.rows) {
        stmts.push({ sql: "DELETE FROM comments WHERE format_id = ?", args: [fmt.id] });
        stmts.push({ sql: "DELETE FROM media WHERE format_id = ?", args: [fmt.id] });
      }
      stmts.push({ sql: "DELETE FROM post_formats WHERE post_id = ?", args: [postId] });
      stmts.push({ sql: "DELETE FROM posts WHERE id = ?", args: [postId] });
      stmts.push({ sql: "UPDATE projects SET post_count = CASE WHEN post_count > 0 THEN post_count - 1 ELSE 0 END WHERE id = ?", args: [projectId] });
      await db.batch(stmts, "write");
      return json(await loadAppData(user));
    }

    if (action === "updatePost") {
      if (!canManage(user)) return json({ error: "Sem permissão." }, { status: 403 });
      await db.execute({ sql: "UPDATE posts SET title = ? WHERE id = ?", args: [String(payload.title ?? ""), String(payload.postId ?? "")] });
      return json(await loadAppData(user));
    }

    if (action === "markNotificationsRead") {
      await db.execute({ sql: "UPDATE notifications SET is_read = 1 WHERE user_id = ?", args: [user.id] });
      return json(await loadAppData(user));
    }

    if (action === "updateFormat") {
      const formatId = String(payload.formatId ?? "");
      const clientId = await formatClientId(formatId);
      if (!clientId || !canAccessClient(user, clientId)) return json({ error: "Sem permissão." }, { status: 403 });

      const oldFmt = (await db.execute({ sql: "SELECT status FROM post_formats WHERE id = ?", args: [formatId] })).rows[0];
      const oldStatus = oldFmt?.status as string;
      const newStatus = String(payload.status ?? oldStatus);

      const oldFmtFull = (await db.execute({ sql: "SELECT * FROM post_formats WHERE id = ?", args: [formatId] })).rows[0];

      if (canManage(user)) {
        await db.execute({
          sql: "UPDATE post_formats SET copy = ?, copy_notes = ?, team_notes = ?, status = ? WHERE id = ?",
          args: [String(payload.copy ?? ""), String(payload.copyNotes ?? ""), String(payload.teamNotes ?? ""), newStatus, formatId],
        });
      } else {
        if (payload.copyNotes !== undefined || payload.teamNotes !== undefined) {
          await db.execute({
            sql: "UPDATE post_formats SET copy_notes = ?, team_notes = ?, status = ? WHERE id = ?",
            args: [String(payload.copyNotes ?? oldFmtFull?.copy_notes ?? ""), String(payload.teamNotes ?? oldFmtFull?.team_notes ?? ""), newStatus === oldStatus ? oldStatus : (["aprovado", "alteracao", "em_revisao"].includes(newStatus) ? newStatus : oldStatus), formatId],
          });
        } else if (newStatus !== oldStatus) {
          if (!["aprovado", "alteracao"].includes(newStatus)) return json({ error: "Clientes só podem aprovar ou pedir alteração." }, { status: 403 });
          await db.execute({ sql: "UPDATE post_formats SET status = ? WHERE id = ?", args: [newStatus, formatId] });
        }
      }

      const ctx = (await db.execute({ sql: "SELECT posts.title, posts.id as post_id, projects.name as project_name, projects.id as project_id, projects.client_id FROM post_formats JOIN posts ON posts.id = post_formats.post_id JOIN projects ON projects.id = posts.project_id WHERE post_formats.id = ?", args: [formatId] })).rows[0];

      if (newStatus !== oldStatus && ctx) {
        const statusLabel = newStatus === "aprovado" ? "aprovado" : newStatus === "alteracao" ? "alteração solicitada" : newStatus === "em_revisao" ? "enviado para revisão" : newStatus;
        if (canManage(user)) {
          const clientUsers = await getUsersForClient(ctx.client_id as string);
          await notify(clientUsers, "status", `Post ${statusLabel}`, `"${ctx.title}" em ${ctx.project_name} foi ${statusLabel}.`, ctx.project_id as string, ctx.post_id as string);
        } else {
          const managers = await getManagerIds();
          await notify(managers, "status", `Cliente ${newStatus === "aprovado" ? "aprovou" : "pediu alteração"}`, `${user.name} ${newStatus === "aprovado" ? "aprovou" : "pediu alteração em"} "${ctx.title}" (${ctx.project_name}).`, ctx.project_id as string, ctx.post_id as string);
        }
      }

      if (ctx) {
        const hasCopyNotes = payload.copyNotes !== undefined && String(payload.copyNotes) !== String(oldFmtFull?.copy_notes ?? "");
        const hasTeamNotes = payload.teamNotes !== undefined && String(payload.teamNotes) !== String(oldFmtFull?.team_notes ?? "");
        if (hasCopyNotes || hasTeamNotes) {
          const field = hasCopyNotes ? "obs. do texto" : "obs. da imagem";
          if (canManage(user)) {
            const clientUsers = await getUsersForClient(ctx.client_id as string);
            await notify(clientUsers, "comment", `Observação atualizada`, `Gestor editou ${field} em "${ctx.title}" (${ctx.project_name}).`, ctx.project_id as string, ctx.post_id as string);
          } else {
            const managers = await getManagerIds();
            await notify(managers, "comment", `Observação atualizada`, `${user.name} editou ${field} em "${ctx.title}" (${ctx.project_name}).`, ctx.project_id as string, ctx.post_id as string);
          }
        }
      }

      return json(await loadAppData(user));
    }

    if (action === "updateMediaNotes") {
      if (!canManage(user)) return json({ error: "Sem permissão." }, { status: 403 });
      await db.execute({ sql: "UPDATE media SET image_notes = ? WHERE id = ?", args: [String(payload.imageNotes ?? ""), String(payload.mediaId ?? "")] });
      return json(await loadAppData(user));
    }

    if (action === "deleteMedia") {
      if (!canManage(user)) return json({ error: "Sem permissão." }, { status: 403 });
      const mediaId = String(payload.mediaId ?? "");
      const mediaResult = await db.execute({ sql: "SELECT url FROM media WHERE id = ?", args: [mediaId] });
      if (mediaResult.rows[0]?.url) {
        const { deleteFile } = await import("@/lib/storage");
        await deleteFile(String(mediaResult.rows[0].url));
      }
      await db.execute({ sql: "DELETE FROM media WHERE id = ?", args: [mediaId] });
      return json(await loadAppData(user));
    }

    if (action === "addComment") {
      const formatId = String(payload.formatId ?? "");
      const clientId = await formatClientId(formatId);
      const text = String(payload.text ?? "").trim();
      if (!clientId || !canAccessClient(user, clientId)) return json({ error: "Sem permissão." }, { status: 403 });
      if (!text) return json({ error: "Escreva uma mensagem." }, { status: 400 });
      await db.batch([
        { sql: "INSERT INTO comments (id, format_id, user_id, text) VALUES (?, ?, ?, ?)", args: [genId("comment"), formatId, user.id, text] },
        ...(user.role === "cliente" ? [{ sql: "UPDATE post_formats SET status = ? WHERE id = ?", args: ["alteracao", formatId] }] : []),
      ], "write");

      const ctx = (await db.execute({ sql: "SELECT posts.title, posts.id as post_id, projects.name as project_name, projects.id as project_id, projects.client_id FROM post_formats JOIN posts ON posts.id = post_formats.post_id JOIN projects ON projects.id = posts.project_id WHERE post_formats.id = ?", args: [formatId] })).rows[0];
      if (ctx) {
        const preview = text.length > 60 ? text.slice(0, 57) + "..." : text;
        if (canManage(user)) {
          const clientUsers = await getUsersForClient(ctx.client_id as string);
          await notify(clientUsers, "comment", "Nova mensagem do gestor", `${user.name}: "${preview}" em ${ctx.title}`, ctx.project_id as string, ctx.post_id as string);
        } else {
          const managers = await getManagerIds();
          await notify(managers, "comment", "Nova mensagem do cliente", `${user.name}: "${preview}" em ${ctx.title}`, ctx.project_id as string, ctx.post_id as string);
        }
      }

      return json(await loadAppData(user));
    }

    if (action === "deleteProjectMedia") {
      if (!canManage(user)) return json({ error: "Sem permissão." }, { status: 403 });
      const projectId = String(payload.projectId ?? "");
      const postRows = (await db.execute({ sql: "SELECT id FROM posts WHERE project_id = ?", args: [projectId] })).rows;
      const postIds = postRows.map((p) => p.id as string);
      if (postIds.length === 0) return json(await loadAppData(user));
      const fmtRows = (await db.execute({ sql: `SELECT id FROM post_formats WHERE post_id IN (${postIds.map(() => "?").join(",")})`, args: postIds })).rows;
      const fmtIds = fmtRows.map((f) => f.id as string);
      if (fmtIds.length === 0) return json(await loadAppData(user));
      const mediaResult = await db.execute({ sql: `SELECT url FROM media WHERE format_id IN (${fmtIds.map(() => "?").join(",")})`, args: fmtIds });
      const { deleteFile } = await import("@/lib/storage");
      for (const row of mediaResult.rows) {
        if (row.url) await deleteFile(String(row.url)).catch(() => {});
      }
      await db.execute({ sql: `DELETE FROM media WHERE format_id IN (${fmtIds.map(() => "?").join(",")})`, args: fmtIds });
      return json(await loadAppData(user));
    }

    return json({ error: "Ação desconhecida." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return json({ error: message }, { status: 500 });
  }
}
