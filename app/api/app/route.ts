import { createHash } from "crypto";
import { getDb } from "@/lib/db";

type Role = "admin" | "gestor" | "cliente";
type FormatKey = "feed" | "story" | "video";

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  client_id: string | null;
  avatar_key: string | null;
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
    avatarUrl: user.avatar_key
      ? `/api/file?key=${encodeURIComponent(user.avatar_key)}`
      : null,
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

function ensureDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tag TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      client_id TEXT,
      avatar_key TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      period TEXT NOT NULL,
      post_count INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      number INTEGER NOT NULL,
      title TEXT NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS post_formats (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      format TEXT NOT NULL,
      status TEXT NOT NULL,
      copy TEXT NOT NULL DEFAULT '',
      copy_notes TEXT NOT NULL DEFAULT '',
      team_notes TEXT NOT NULL DEFAULT ''
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      format_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      r2_key TEXT NOT NULL,
      image_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      format_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const count = db.prepare("SELECT COUNT(*) as count FROM users").get() as {
    count: number;
  };
  if (count.count > 0) return;

  const client1 = "cliente-01";
  const client2 = "cliente-02";

  const seed = db.transaction(() => {
    db.prepare("INSERT INTO clients (id, name, tag) VALUES (?, ?, ?)").run(
      client1,
      "Cliente 01",
      "fast-acai"
    );
    db.prepare("INSERT INTO clients (id, name, tag) VALUES (?, ?, ?)").run(
      client2,
      "Cliente 02",
      "studio-nova"
    );
    db.prepare(
      "INSERT INTO users (id, name, email, password_hash, role, client_id) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("u-admin", "Administrador", "admin@painel.com", hashPassword("admin123"), "admin", null);
    db.prepare(
      "INSERT INTO users (id, name, email, password_hash, role, client_id) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("u-gestor", "Gestor Social", "gestor@painel.com", hashPassword("gestor123"), "gestor", null);
    db.prepare(
      "INSERT INTO users (id, name, email, password_hash, role, client_id) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("u-cliente-01", "Cliente 01", "cliente01@painel.com", hashPassword("cliente123"), "cliente", client1);
    db.prepare(
      "INSERT INTO users (id, name, email, password_hash, role, client_id) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("u-cliente-02", "Cliente 02", "cliente02@painel.com", hashPassword("cliente123"), "cliente", client2);
  });
  seed();

  createProjectRows({ clientId: client1, name: "Rede social Junho", period: "Junho 2026", postCount: 16 });
  createProjectRows({ clientId: client1, name: "Rede social Julho", period: "Julho 2026", postCount: 12 });
  createProjectRows({ clientId: client2, name: "Campanha Junho", period: "Junho 2026", postCount: 8 });
}

function createProjectRows({
  clientId,
  name,
  period,
  postCount,
}: {
  clientId: string;
  name: string;
  period: string;
  postCount: number;
}) {
  const db = getDb();
  const projectId = genId("project");

  const insertProject = db.transaction(() => {
    db.prepare(
      "INSERT INTO projects (id, client_id, name, period, post_count) VALUES (?, ?, ?, ?, ?)"
    ).run(projectId, clientId, name, period, postCount);

    for (let number = 1; number <= postCount; number += 1) {
      const postId = genId("post");
      db.prepare(
        "INSERT INTO posts (id, project_id, number, title) VALUES (?, ?, ?, ?)"
      ).run(postId, projectId, number, `Post ${String(number).padStart(2, "0")}`);

      for (const format of formats) {
        db.prepare(
          "INSERT INTO post_formats (id, post_id, format, status) VALUES (?, ?, ?, ?)"
        ).run(genId("format"), postId, format, "rascunho");
      }
    }
  });
  insertProject();

  return projectId;
}

function createPostRows(projectId: string, number: number) {
  const db = getDb();
  const postId = genId("post");

  const insertPost = db.transaction(() => {
    db.prepare(
      "INSERT INTO posts (id, project_id, number, title) VALUES (?, ?, ?, ?)"
    ).run(postId, projectId, number, `Post ${String(number).padStart(2, "0")}`);

    for (const format of formats) {
      db.prepare(
        "INSERT INTO post_formats (id, post_id, format, status) VALUES (?, ?, ?, ?)"
      ).run(genId("format"), postId, format, "rascunho");
    }
  });
  insertPost();

  return postId;
}

function currentUser(request: Request): PublicUser | null {
  const token = cookieValue(request, sessionCookie);
  if (!token) return null;
  const now = Date.now();
  const row = getDb()
    .prepare(
      "SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ? AND sessions.expires_at > ?"
    )
    .get(token, now) as UserRow | undefined;
  return row ? publicUser(row) : null;
}

function loadAppData(user: PublicUser | null) {
  if (!user) return { user: null, clients: [], users: [], projects: [] };

  const db = getDb();

  const clients = canManage(user)
    ? db.prepare("SELECT * FROM clients ORDER BY name").all()
    : db.prepare("SELECT * FROM clients WHERE id = ?").all(user.clientId);

  const userRows = canManage(user)
    ? db
        .prepare(
          "SELECT id, name, email, role, client_id as clientId, avatar_key as avatarKey FROM users ORDER BY created_at DESC"
        )
        .all()
    : [];
  const users = (userRows as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    avatarUrl: row.avatarKey
      ? `/api/file?key=${encodeURIComponent(String(row.avatarKey))}`
      : null,
  }));

  const projectRows = canManage(user)
    ? db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all()
    : db
        .prepare(
          "SELECT * FROM projects WHERE client_id = ? ORDER BY created_at DESC"
        )
        .all(user.clientId);

  const postRows = db.prepare("SELECT * FROM posts ORDER BY number").all() as Array<Record<string, unknown>>;
  const formatRows = db.prepare("SELECT * FROM post_formats").all() as Array<Record<string, unknown>>;
  const mediaRows = db
    .prepare("SELECT * FROM media ORDER BY created_at")
    .all() as Array<Record<string, unknown>>;
  const commentRows = db
    .prepare(
      "SELECT comments.*, users.name as author, users.role as role FROM comments JOIN users ON users.id = comments.user_id ORDER BY comments.created_at"
    )
    .all() as Array<Record<string, unknown>>;

  return {
    user,
    clients,
    users,
    projects: (projectRows as Array<Record<string, unknown>>).map((project) => ({
      id: project.id,
      clientId: project.client_id,
      name: project.name,
      period: project.period,
      postCount: project.post_count,
      posts: postRows
        .filter((post) => post.project_id === project.id)
        .map((post) => ({
          id: post.id,
          number: post.number,
          title: post.title,
          formats: Object.fromEntries(
            formats.map((format) => {
              const item = formatRows.find(
                (row) => row.post_id === post.id && row.format === format
              );
              return [
                format,
                {
                  id: item?.id,
                  status: item?.status ?? "rascunho",
                  copy: item?.copy ?? "",
                  copyNotes: item?.copy_notes ?? "",
                  teamNotes: item?.team_notes ?? "",
                  media: mediaRows
                    .filter((media) => media.format_id === item?.id)
                    .map((media) => ({
                      id: media.id,
                      name: media.name,
                      type: media.type,
                      url: `/api/file?key=${encodeURIComponent(String(media.r2_key))}`,
                      imageNotes: media.image_notes,
                    })),
                  comments: commentRows
                    .filter((comment) => comment.format_id === item?.id)
                    .map((comment) => ({
                      id: comment.id,
                      author: comment.author,
                      role: comment.role,
                      text: comment.text,
                      createdAt: comment.created_at,
                    })),
                },
              ];
            })
          ),
        })),
    })),
  };
}

function formatClientId(formatId: string): string | null {
  const row = getDb()
    .prepare(
      "SELECT projects.client_id as client_id FROM post_formats JOIN posts ON posts.id = post_formats.post_id JOIN projects ON projects.id = posts.project_id WHERE post_formats.id = ?"
    )
    .get(formatId) as { client_id: string } | undefined;
  return row?.client_id ?? null;
}

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export async function GET(request: Request) {
  try {
    ensureDb();
    const user = currentUser(request);
    return json(loadAppData(user));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    ensureDb();
    const payload = (await request.json()) as Record<string, unknown>;
    const action = payload.action;
    const db = getDb();

    if (action === "login") {
      const email = String(payload.email ?? "").trim().toLowerCase();
      const password = String(payload.password ?? "");
      const row = db
        .prepare("SELECT * FROM users WHERE lower(email) = ?")
        .get(email) as UserRow | undefined;
      if (!row || row.password_hash !== hashPassword(password)) {
        return json({ error: "Email ou senha invalidos." }, { status: 401 });
      }
      const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      db.prepare(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
      ).run(token, row.id, Date.now() + 1000 * 60 * 60 * 24 * 30);
      return json(loadAppData(publicUser(row)), {
        headers: {
          "Set-Cookie": cookieHeader(request, token, 60 * 60 * 24 * 30),
        },
      });
    }

    if (action === "logout") {
      const token = cookieValue(request, sessionCookie);
      if (token)
        db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
      return json(
        { ok: true },
        { headers: { "Set-Cookie": cookieHeader(request, "", 0) } }
      );
    }

    const user = currentUser(request);
    if (!user) return json({ error: "Login necessario." }, { status: 401 });

    if (action === "createUser") {
      if (!canManage(user))
        return json({ error: "Sem permissao." }, { status: 403 });
      const name = String(payload.name ?? "").trim();
      const email = String(payload.email ?? "").trim().toLowerCase();
      const password = String(payload.password ?? "");
      const role = String(payload.role ?? "cliente") as Role;
      const clientId = role === "cliente" ? String(payload.clientId ?? "") : null;
      if (
        !name ||
        !email ||
        !password ||
        !["admin", "gestor", "cliente"].includes(role)
      ) {
        return json(
          { error: "Preencha nome, email, senha e cargo." },
          { status: 400 }
        );
      }
      db.prepare(
        "INSERT INTO users (id, name, email, password_hash, role, client_id) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(genId("user"), name, email, hashPassword(password), role, clientId);
      return json(loadAppData(user));
    }

    if (action === "updateUser") {
      if (!canManage(user))
        return json({ error: "Sem permissao." }, { status: 403 });
      const userId = String(payload.userId ?? "");
      const name = String(payload.name ?? "").trim();
      const email = String(payload.email ?? "").trim().toLowerCase();
      const role = String(payload.role ?? "cliente") as Role;
      const clientId = role === "cliente" ? String(payload.clientId ?? "") : null;
      if (!name || !email || !["admin", "gestor", "cliente"].includes(role))
        return json({ error: "Preencha nome, email e cargo." }, { status: 400 });
      const password = String(payload.password ?? "").trim();
      if (password) {
        db.prepare(
          "UPDATE users SET name = ?, email = ?, password_hash = ?, role = ?, client_id = ? WHERE id = ?"
        ).run(name, email, hashPassword(password), role, clientId, userId);
      } else {
        db.prepare(
          "UPDATE users SET name = ?, email = ?, role = ?, client_id = ? WHERE id = ?"
        ).run(name, email, role, clientId, userId);
      }
      return json(loadAppData(user));
    }

    if (action === "deleteUser") {
      if (!canManage(user))
        return json({ error: "Sem permissao." }, { status: 403 });
      const userId = String(payload.userId ?? "");
      if (userId === user.id)
        return json(
          { error: "Voce nao pode apagar seu proprio usuario." },
          { status: 400 }
        );
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
      return json(loadAppData(user));
    }

    if (action === "createClient") {
      if (!canManage(user))
        return json({ error: "Sem permissao." }, { status: 403 });
      const name = String(payload.name ?? "").trim();
      const tag = String(payload.tag ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      if (!name)
        return json(
          { error: "Informe o nome do cliente." },
          { status: 400 }
        );
      db.prepare(
        "INSERT INTO clients (id, name, tag) VALUES (?, ?, ?)"
      ).run(
        genId("client"),
        name,
        tag || name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
      );
      return json(loadAppData(user));
    }

    if (action === "createProject") {
      if (!canManage(user))
        return json({ error: "Sem permissao." }, { status: 403 });
      const name = String(payload.name ?? "").trim();
      const period = String(payload.period ?? name).trim();
      const clientId = String(payload.clientId ?? "");
      const postCount = Math.max(
        1,
        Math.min(120, Number(payload.postCount ?? 1))
      );
      if (!name || !clientId)
        return json(
          { error: "Informe nome e cliente." },
          { status: 400 }
        );
      createProjectRows({ clientId, name, period, postCount });
      return json(loadAppData(user));
    }

    if (action === "createPost") {
      if (!canManage(user))
        return json({ error: "Sem permissao." }, { status: 403 });
      const projectId = String(payload.projectId ?? "");
      const project = db
        .prepare("SELECT * FROM projects WHERE id = ?")
        .get(projectId) as { id: string; post_count: number } | undefined;
      if (!project)
        return json(
          { error: "Projeto nao encontrado." },
          { status: 404 }
        );
      const maxRow = db
        .prepare(
          "SELECT MAX(number) as max_number FROM posts WHERE project_id = ?"
        )
        .get(projectId) as { max_number: number | null } | undefined;
      const nextNumber = (maxRow?.max_number ?? 0) + 1;
      const postId = createPostRows(projectId, nextNumber);
      db.prepare(
        "UPDATE projects SET post_count = post_count + 1 WHERE id = ?"
      ).run(projectId);
      return json({ ...loadAppData(user), createdPostId: postId });
    }

    if (action === "deletePost") {
      if (!canManage(user))
        return json({ error: "Sem permissao." }, { status: 403 });
      const postId = String(payload.postId ?? "");
      const post = db
        .prepare("SELECT project_id FROM posts WHERE id = ?")
        .get(postId) as { project_id: string } | undefined;
      if (!post)
        return json({ error: "Post nao encontrado." }, { status: 404 });

      const deleteAll = db.transaction(() => {
        const fmtRows = db
          .prepare("SELECT id FROM post_formats WHERE post_id = ?")
          .all(postId) as Array<{ id: string }>;
        for (const fmt of fmtRows) {
          db.prepare("DELETE FROM comments WHERE format_id = ?").run(fmt.id);
          db.prepare("DELETE FROM media WHERE format_id = ?").run(fmt.id);
        }
        db.prepare("DELETE FROM post_formats WHERE post_id = ?").run(postId);
        db.prepare("DELETE FROM posts WHERE id = ?").run(postId);
        db.prepare(
          "UPDATE projects SET post_count = CASE WHEN post_count > 0 THEN post_count - 1 ELSE 0 END WHERE id = ?"
        ).run(post.project_id);
      });
      deleteAll();

      return json(loadAppData(user));
    }

    if (action === "updatePost") {
      if (!canManage(user))
        return json({ error: "Sem permissao." }, { status: 403 });
      db.prepare("UPDATE posts SET title = ? WHERE id = ?").run(
        String(payload.title ?? ""),
        String(payload.postId ?? "")
      );
      return json(loadAppData(user));
    }

    if (action === "updateFormat") {
      const formatId = String(payload.formatId ?? "");
      const clientId = formatClientId(formatId);
      if (!clientId || !canAccessClient(user, clientId))
        return json({ error: "Sem permissao." }, { status: 403 });
      if (canManage(user)) {
        db.prepare(
          "UPDATE post_formats SET copy = ?, copy_notes = ?, team_notes = ?, status = ? WHERE id = ?"
        ).run(
          String(payload.copy ?? ""),
          String(payload.copyNotes ?? ""),
          String(payload.teamNotes ?? ""),
          String(payload.status ?? "rascunho"),
          formatId
        );
      } else {
        const status = String(payload.status ?? "");
        if (!["aprovado", "alteracao"].includes(status))
          return json(
            { error: "Clientes so podem aprovar ou pedir alteracao." },
            { status: 403 }
          );
        db.prepare("UPDATE post_formats SET status = ? WHERE id = ?").run(
          status,
          formatId
        );
      }
      return json(loadAppData(user));
    }

    if (action === "updateMediaNotes") {
      if (!canManage(user))
        return json({ error: "Sem permissao." }, { status: 403 });
      db.prepare("UPDATE media SET image_notes = ? WHERE id = ?").run(
        String(payload.imageNotes ?? ""),
        String(payload.mediaId ?? "")
      );
      return json(loadAppData(user));
    }

    if (action === "deleteMedia") {
      if (!canManage(user))
        return json({ error: "Sem permissao." }, { status: 403 });
      const mediaId = String(payload.mediaId ?? "");
      db.prepare("DELETE FROM media WHERE id = ?").run(mediaId);
      return json(loadAppData(user));
    }

    if (action === "addComment") {
      const formatId = String(payload.formatId ?? "");
      const clientId = formatClientId(formatId);
      const text = String(payload.text ?? "").trim();
      if (!clientId || !canAccessClient(user, clientId))
        return json({ error: "Sem permissao." }, { status: 403 });
      if (!text)
        return json({ error: "Escreva uma mensagem." }, { status: 400 });
      db.prepare(
        "INSERT INTO comments (id, format_id, user_id, text) VALUES (?, ?, ?, ?)"
      ).run(genId("comment"), formatId, user.id, text);
      if (user.role === "cliente") {
        db.prepare(
          "UPDATE post_formats SET status = ? WHERE id = ?"
        ).run("alteracao", formatId);
      }
      return json(loadAppData(user));
    }

    return json({ error: "Acao desconhecida." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return json({ error: message }, { status: 500 });
  }
}
