"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";

type Role = "admin" | "gestor" | "cliente";
type View = "home" | "projetos" | "novoProjeto" | "usuarios" | "configuracoes";
type FormatKey = "feed" | "story" | "video";
type ApprovalStatus = "rascunho" | "em_revisao" | "alteracao" | "aprovado";

type User = { id: string; name: string; email: string; role: Role; clientId: string | null; avatarUrl: string | null };
type Client = { id: string; name: string; tag: string };
type MediaAsset = { id: string; name: string; type: "image" | "video"; url: string; imageNotes: string };
type Comment = { id: string; author: string; role: Role; text: string; createdAt?: string };
type FormatItem = { id: string; status: ApprovalStatus; copy: string; copyNotes: string; teamNotes: string; media: MediaAsset[]; comments: Comment[] };
type Post = { id: string; number: number; title: string; formats: Record<FormatKey, FormatItem> };
type Project = { id: string; clientId: string; name: string; period: string; postCount: number; posts: Post[] };
type AppData = { user: User | null; users: User[]; clients: Client[]; projects: Project[] };

const emptyData: AppData = { user: null, users: [], clients: [], projects: [] };
const formatLabels: Record<FormatKey, string> = { feed: "Feed", story: "Story", video: "Video/Reels" };
const statusLabels: Record<ApprovalStatus, string> = { rascunho: "Rascunho", em_revisao: "Em revisao", alteracao: "Alteracao", aprovado: "Aprovado" };

function isMediaFile(file: File) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return type.startsWith("image/") || type.startsWith("video/") || /\.(png|jpe?g|webp|gif|avif|bmp|svg|mp4|mov|m4v|webm|avi|mkv)$/i.test(name);
}

function A1Logo({ className = "", white = false }: { className?: string; white?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 480 375" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M276.32,124.09l-37.64,59.32h84.55c4,0,7.24,3.24,7.24,7.24v78.59c0,4-3.24,7.24-7.24,7.24h-143.61l-60.53,95.4c-1.33,2.09-3.63,3.36-6.11,3.36H7.25c-5.71,0-9.17-6.3-6.11-11.11l55.61-87.65,59.06-93.07,37.64-59.32L230.06,3.36c1.33-2.09,3.63-3.36,6.11-3.36h105.73c5.71,0,9.17,6.3,6.11,11.11l-17.54,27.65-54.15,85.33Z" fill={white ? "#ffffff" : "#1A1A1A"} />
      <path d="M476.65,7.24v360.77c0,4-3.24,7.24-7.24,7.24h-96.06c-4,0-7.24-3.24-7.24-7.24V124.09h-28.41c-4,0-7.24-3.24-7.24-7.24v-26.47c0-1.37.39-2.72,1.13-3.88l34.52-54.4,18.24-28.75c1.33-2.09,3.63-3.36,6.11-3.36h78.94c4,0,7.24,3.24,7.24,7.24Z" fill="#FF6A13" />
    </svg>
  );
}

function Ic({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const icons = {
  home: "M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-4v-6h-4v-1h-4v7H6a1 1 0 01-1-1V9.5z",
  folder: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z",
  users: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
  plus: "M12 5v14M5 12h14",
  moon: "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
  sun: "M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 17a5 5 0 100-10 5 5 0 000 10z",
  logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  menu: "M3 12h18M3 6h18M3 18h18",
  upload: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4z",
  image: "M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 15l-5-5L5 21",
  check: "M20 6L9 17l-5-5",
  x: "M18 6L6 18M6 6l12 12",
  msg: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  trash: "M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2",
  arrowRight: "M5 12h14M12 5l7 7-7 7",
};

const navItems: Array<{ id: View; label: string; icon: string; managerOnly?: boolean }> = [
  { id: "home", label: "Home", icon: "home" },
  { id: "projetos", label: "Projetos", icon: "folder" },
  { id: "usuarios", label: "Usuarios", icon: "users", managerOnly: true },
  { id: "configuracoes", label: "Configuracoes", icon: "settings" },
];

export default function Home() {
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [activeView, setActiveView] = useState<View>("home");
  const [activeProjectId, setActiveProjectId] = useState("");
  const [activePostId, setActivePostId] = useState("");
  const [activeFormat, setActiveFormat] = useState<FormatKey>("feed");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [postMutation, setPostMutation] = useState<"create" | "delete" | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectPeriod, setNewProjectPeriod] = useState("");
  const [newProjectClientId, setNewProjectClientId] = useState("");
  const [newProjectCount, setNewProjectCount] = useState(16);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "cliente" as Role, clientId: "" });
  const [newClientName, setNewClientName] = useState("");
  const [newClientTag, setNewClientTag] = useState("");

  const canManage = data.user?.role === "admin" || data.user?.role === "gestor";
  const activeProject = data.projects.find((p) => p.id === activeProjectId) ?? data.projects[0];
  const activePost = activeProject?.posts.find((p) => p.id === activePostId) ?? activeProject?.posts[0];
  const activeItem = activePost?.formats[activeFormat];
  const activeClient = data.clients.find((c) => c.id === activeProject?.clientId);

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!activeProjectId && data.projects[0]) setActiveProjectId(data.projects[0].id);
    if (!activePostId && data.projects[0]?.posts[0]) setActivePostId(data.projects[0].posts[0].id);
    if (!newProjectClientId && data.clients[0]) setNewProjectClientId(data.clients[0].id);
    if (!newUser.clientId && data.clients[0]) setNewUser((u) => ({ ...u, clientId: data.clients[0].id }));
  }, [activePostId, activeProjectId, data.clients, data.projects, newProjectClientId, newUser.clientId]);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/app", { credentials: "include" });
      const d = await res.json();
      setData(d);
      setError(d.error ?? "");
    } finally { setLoading(false); }
  }

  async function action(name: string, payload: Record<string, unknown> = {}) {
    setError("");
    const res = await fetch("/api/app", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ action: name, ...payload }) });
    const d = await res.json();
    if (!res.ok) { setError(d.error ?? "Nao foi possivel salvar."); return null; }
    if (d.projects || d.user !== undefined) setData(d);
    return d;
  }

  async function login() { const d = await action("login", { email: loginEmail, password: loginPassword }); if (d?.user) setActiveView("home"); }
  async function logout() { await action("logout"); setData(emptyData); setActiveView("home"); }

  async function createProject() {
    const d = await action("createProject", { name: newProjectName, period: newProjectPeriod || newProjectName, clientId: newProjectClientId, postCount: newProjectCount });
    if (d) { setNewProjectName(""); setNewProjectPeriod(""); setActiveView("projetos"); }
  }

  async function createPost() {
    if (!activeProject || postMutation) return;
    setPostMutation("create");
    try { const d = await action("createPost", { projectId: activeProject.id }); if (d?.createdPostId) setActivePostId(String(d.createdPostId)); } finally { setPostMutation(null); }
  }

  async function deletePost() {
    if (!activePost || !activeProject || postMutation) return;
    setPostMutation("delete");
    try {
      const d = await action("deletePost", { postId: activePost.id });
      if (d?.projects) { const np = d.projects.find((p: Project) => p.id === activeProject.id); setActivePostId(np?.posts[0]?.id ?? ""); }
    } finally { setPostMutation(null); }
  }

  async function createUser() { const d = await action("createUser", newUser); if (d) setNewUser({ name: "", email: "", password: "", role: "cliente", clientId: data.clients[0]?.id ?? "" }); }
  async function deleteUser(userId: string) { await action("deleteUser", { userId }); }
  async function createClient() { const d = await action("createClient", { name: newClientName, tag: newClientTag }); if (d) { setNewClientName(""); setNewClientTag(""); } }

  async function uploadFiles(files: FileList | File[] | null) {
    if (!files || !activeItem || uploadingMedia) return;
    const sel = Array.from(files).filter(isMediaFile);
    if (sel.length === 0) { setError("Envie imagens ou videos."); return; }
    setError(""); setUploadingMedia(true);
    const form = new FormData(); form.append("formatId", activeItem.id); sel.forEach((f) => form.append("files", f));
    try { const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: form }); const r = await res.json(); if (!res.ok) { setError(r.error ?? "Erro no upload."); return; } await refresh(); } finally { setUploadingMedia(false); }
  }

  async function uploadProfilePhoto(file: File | null) {
    if (!file) return; setError("");
    const form = new FormData(); form.append("file", file);
    const res = await fetch("/api/profile-photo", { method: "POST", credentials: "include", body: form });
    const r = await res.json(); if (!res.ok) { setError(r.error ?? "Erro ao salvar foto."); return; } await refresh();
  }

  async function saveFormat(fields: Partial<FormatItem>) {
    if (!activeItem) return;
    await action("updateFormat", { formatId: activeItem.id, copy: fields.copy ?? activeItem.copy, copyNotes: fields.copyNotes ?? activeItem.copyNotes, teamNotes: fields.teamNotes ?? activeItem.teamNotes, status: fields.status ?? activeItem.status });
  }

  async function addComment() {
    if (!activeItem || !commentDraft.trim()) return;
    const d = await action("addComment", { formatId: activeItem.id, text: commentDraft }); if (d) setCommentDraft("");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <A1Logo className="h-12 w-auto" />
          <span className="loading-dot text-accent" style={{ width: 24, height: 24, borderWidth: 3 }} />
        </div>
      </main>
    );
  }

  if (!data.user) {
    return (
      <main className="flex min-h-screen">
        <div className="hidden flex-1 flex-col justify-between bg-[#1A1A1A] p-12 text-white lg:flex">
          <A1Logo className="h-10 w-auto self-start" white />
          <div className="max-w-md">
            <h1 className="font-display text-[2.75rem] font-bold leading-[1.1] tracking-tight">
              Gerencie posts.<br />
              <span className="text-[#FF6A13]">Aprove rapido.</span>
            </h1>
            <p className="mt-5 text-[15px] leading-7 text-[#888]">
              Feed, Story e Video/Reels organizados por projeto. Seu cliente aprova com um clique.
            </p>
          </div>
          <p className="text-xs text-[#555] font-display tracking-wider uppercase">Criatividade com estrategia.</p>
        </div>

        <div className="flex flex-1 items-center justify-center bg-surface p-8">
          <form className="w-full max-w-sm animate-in" onSubmit={(e) => { e.preventDefault(); login(); }}>
            <div className="mb-10 lg:hidden"><A1Logo className="h-9 w-auto" /></div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Entrar</h2>
            <p className="mt-1.5 text-sm text-secondary">Acesse o painel do seu projeto.</p>
            <label className="mt-8 block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Email</span>
              <input className="field mt-1.5" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
            </label>
            <label className="mt-4 block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Senha</span>
              <input className="field mt-1.5" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
            </label>
            {error && <p className="mt-3 rounded-lg bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]">{error}</p>}
            <button className="btn btn-primary mt-7 w-full py-3 text-[15px]">Entrar</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className={darkMode ? "dark" : ""}>
      <div className="flex min-h-screen bg-surface text-on-surface">
        <aside className={`sidebar ${menuOpen ? "" : "collapsed"}`}>
          <div className="flex flex-col gap-0.5 p-3">
            <div className={`mb-3 flex items-center ${menuOpen ? "justify-between" : "justify-center"} px-1 py-3`}>
              <A1Logo className={menuOpen ? "h-7 w-auto" : "h-6 w-auto"} white />
              <button className="rounded-lg p-1.5 text-[#666] hover:bg-[#262626] hover:text-white transition" onClick={() => setMenuOpen((o) => !o)}>
                <Ic d={icons.menu} size={17} />
              </button>
            </div>
            {canManage && (
              <button
                className={`mb-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold font-display bg-[#FF6A13] text-white hover:bg-[#e55d0e] transition ${menuOpen ? "" : "justify-center px-0"}`}
                onClick={() => setActiveView("novoProjeto")}
              >
                <Ic d={icons.plus} size={16} />
                {menuOpen && <span>Novo projeto</span>}
              </button>
            )}
            <div className="mt-1 space-y-0.5">
              {navItems.filter((v) => !v.managerOnly || canManage).map((v) => (
                <button key={v.id} className={`sidebar-link ${activeView === v.id ? "active" : ""} ${menuOpen ? "" : "justify-center px-0 gap-0"}`} onClick={() => setActiveView(v.id)}>
                  <Ic d={icons[v.icon as keyof typeof icons]} size={18} />
                  {menuOpen && <span>{v.label}</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-auto border-t border-[#262626] p-3">
            <div className={`flex items-center gap-2.5 ${menuOpen ? "" : "justify-center"}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF6A13] text-xs font-bold text-white">
                {data.user.name.slice(0, 2).toUpperCase()}
              </span>
              {menuOpen && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{data.user.name}</p>
                  <p className="truncate text-[11px] capitalize text-[#666]">{data.user.role}</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-outline bg-raised px-6 py-3">
            <h1 className="font-display text-lg font-bold">{viewTitle(activeView)}</h1>
            <div className="flex items-center gap-1.5">
              <button className="btn btn-ghost text-xs" onClick={() => setDarkMode((v) => !v)}>
                <Ic d={darkMode ? icons.sun : icons.moon} size={16} />
              </button>
              <button className="btn btn-ghost text-xs" onClick={logout}>
                <Ic d={icons.logout} size={16} />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </header>

          <section className="flex-1 overflow-auto p-6">
            {error && <div className="mb-4 rounded-xl bg-[var(--danger-bg)] px-4 py-3 text-sm font-medium text-[var(--danger-text)]">{error}</div>}
            {activeView === "home" && <HomeView data={data} canManage={canManage} setActiveView={setActiveView} setActiveProjectId={setActiveProjectId} setActivePostId={setActivePostId} />}
            {activeView === "projetos" && activeProject && activePost && activeItem && (
              <ProjectsView activeClient={activeClient} activeFormat={activeFormat} activeItem={activeItem} activePost={activePost} activeProject={activeProject} canManage={canManage} createPost={createPost} deletePost={deletePost} postMutation={postMutation} projects={data.projects} clients={data.clients} uploadingMedia={uploadingMedia} setActiveFormat={setActiveFormat} setActivePostId={setActivePostId} setActiveProjectId={setActiveProjectId} uploadFiles={uploadFiles} saveFormat={saveFormat} savePostTitle={(title) => action("updatePost", { postId: activePost.id, title })} saveMediaNotes={(mediaId, imageNotes) => action("updateMediaNotes", { mediaId, imageNotes })} deleteMedia={(mediaId) => action("deleteMedia", { mediaId })} setStatus={(status) => saveFormat({ status })} commentDraft={commentDraft} setCommentDraft={setCommentDraft} addComment={addComment} />
            )}
            {activeView === "novoProjeto" && canManage && (
              <NewProjectView clients={data.clients} createProject={createProject} newProjectClientId={newProjectClientId} newProjectCount={newProjectCount} newProjectName={newProjectName} newProjectPeriod={newProjectPeriod} setNewProjectClientId={setNewProjectClientId} setNewProjectCount={setNewProjectCount} setNewProjectName={setNewProjectName} setNewProjectPeriod={setNewProjectPeriod} />
            )}
            {activeView === "usuarios" && canManage && (
              <UsersView clients={data.clients} createUser={createUser} createClient={createClient} deleteUser={deleteUser} updateUser={(payload) => action("updateUser", payload)} newClientName={newClientName} newClientTag={newClientTag} newUser={newUser} setNewClientName={setNewClientName} setNewClientTag={setNewClientTag} setNewUser={setNewUser} users={data.users} />
            )}
            {activeView === "configuracoes" && <SettingsView darkMode={darkMode} setDarkMode={setDarkMode} uploadProfilePhoto={uploadProfilePhoto} user={data.user} />}
          </section>

          <footer className="border-t border-outline bg-raised px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <A1Logo className="h-4 w-auto opacity-40" />
              <span className="text-[11px] text-muted font-display tracking-wider uppercase">A1 Studio</span>
            </div>
            <span className="text-[11px] text-muted">Criatividade com estrategia.</span>
          </footer>
        </div>
      </div>
    </main>
  );
}

function HomeView({ data, canManage, setActiveView, setActiveProjectId, setActivePostId }: { data: AppData; canManage: boolean; setActiveView: (v: View) => void; setActiveProjectId: (id: string) => void; setActivePostId: (id: string) => void }) {
  const postCount = data.projects.reduce((s, p) => s + p.posts.length, 0);
  const fmts = data.projects.flatMap((p) => p.posts.flatMap((post) => Object.values(post.formats)));
  const grouped = useMemo(() => {
    const map = new Map<string, { client: Client; projects: Project[] }>();
    for (const c of data.clients) map.set(c.id, { client: c, projects: [] });
    for (const p of data.projects) {
      const entry = map.get(p.clientId);
      if (entry) entry.projects.push(p);
    }
    return Array.from(map.values()).filter((e) => e.projects.length > 0);
  }, [data.clients, data.projects]);
  return (
    <div className="animate-in space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Bem-vindo de volta</h2>
        <p className="mt-1 text-sm text-secondary">Acompanhe seus projetos e aprovacoes.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Clientes" value={data.clients.length} />
        <Metric label="Projetos" value={data.projects.length} />
        <Metric label="Posts totais" value={postCount} />
        <Metric label="Aprovados" value={fmts.filter((f) => f.status === "aprovado").length} accent />
      </div>
      {grouped.map((g) => (
        <div key={g.client.id}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display font-semibold">{g.client.name}</h3>
            <button className="btn btn-ghost text-xs" onClick={() => setActiveView("projetos")}>Ver todos <Ic d={icons.arrowRight} size={14} /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.projects.map((p) => (
              <button key={p.id} className="group card text-left transition hover:border-accent" onClick={() => { setActiveProjectId(p.id); setActivePostId(p.posts[0]?.id ?? ""); setActiveView("projetos"); }}>
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-semibold group-hover:text-accent transition">{p.name}</span>
                  <span className="text-muted group-hover:text-accent transition"><Ic d={icons.arrowRight} size={16} /></span>
                </div>
                <p className="mt-1.5 text-xs text-muted">{p.period} &middot; {p.posts.length} posts</p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="card">
      <p className={`font-display text-3xl font-bold tracking-tight ${accent ? "text-accent" : ""}`}>{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

function ProjectsView(props: {
  activeClient?: Client; activeFormat: FormatKey; activeItem: FormatItem; activePost: Post; activeProject: Project; canManage: boolean; projects: Project[]; clients: Client[];
  commentDraft: string; createPost: () => Promise<void>; deletePost: () => Promise<void>; postMutation: "create" | "delete" | null; uploadingMedia: boolean; addComment: () => void;
  saveFormat: (fields: Partial<FormatItem>) => void; savePostTitle: (title: string) => void; saveMediaNotes: (mediaId: string, imageNotes: string) => void; deleteMedia: (mediaId: string) => void;
  setActiveFormat: (f: FormatKey) => void; setActivePostId: (id: string) => void; setActiveProjectId: (id: string) => void; setStatus: (s: ApprovalStatus) => void;
  setCommentDraft: (v: string) => void; uploadFiles: (files: FileList | File[] | null) => Promise<void>;
}) {
  const [dragActive, setDragActive] = useState(false);
  const grouped = useMemo(() => {
    const map = new Map<string, { client: Client; projects: Project[] }>();
    for (const c of props.clients) map.set(c.id, { client: c, projects: [] });
    for (const p of props.projects) {
      const entry = map.get(p.clientId);
      if (entry) entry.projects.push(p);
    }
    return Array.from(map.values()).filter((e) => e.projects.length > 0);
  }, [props.clients, props.projects]);
  return (
    <div className="animate-in grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
      <aside className="space-y-4 max-h-[calc(100vh-140px)] overflow-auto pr-1">
        {grouped.map((g) => (
          <div key={g.client.id}>
            <h3 className="px-1 mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted font-display">{g.client.name}</h3>
            <div className="space-y-1">
              {g.projects.map((p) => (
                <button key={p.id} className={`w-full rounded-xl p-3 text-left transition ${p.id === props.activeProject.id ? "bg-accent-subtle border border-accent/30" : "hover:bg-sunken border border-transparent"}`} onClick={() => { props.setActiveProjectId(p.id); props.setActivePostId(p.posts[0]?.id ?? ""); }}>
                  <span className={`block text-sm font-semibold ${p.id === props.activeProject.id ? "text-accent" : ""}`}>{p.name}</span>
                  <span className="mt-0.5 block text-[11px] text-muted">{p.period} &middot; {p.posts.length} posts</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </aside>

      <section className="space-y-4">
        <div className="card">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted font-display">{props.activeProject.name}</p>
              <input className="field mt-1 max-w-[280px] font-display font-semibold" defaultValue={props.activePost.title} disabled={!props.canManage} key={props.activePost.id} onBlur={(e) => props.savePostTitle(e.target.value)} />
            </div>
            {props.canManage && (
              <div className="flex gap-2">
                <button className="btn btn-outline text-xs" disabled={props.postMutation !== null} onClick={props.createPost}><Ic d={icons.plus} size={14} /> Novo post</button>
                <button className="btn btn-danger text-xs" disabled={props.postMutation !== null} onClick={props.deletePost}><Ic d={icons.trash} size={14} /></button>
              </div>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {props.activeProject.posts.map((post) => (
              <button key={post.id} className={`rounded-xl border p-2.5 text-left transition ${post.id === props.activePost.id ? "border-accent bg-accent-subtle" : "border-outline hover:border-accent/40"}`} onClick={() => props.setActivePostId(post.id)}>
                <span className="text-[11px] font-bold text-accent">#{String(post.number).padStart(2, "0")}</span>
                <span className="mt-0.5 block truncate text-xs font-semibold">{post.title}</span>
                <span className="mt-1 flex gap-1">
                  {(Object.keys(formatLabels) as FormatKey[]).map((f) => (
                    <span key={f} className={`status-${post.formats[f].status} rounded px-1.5 py-0.5 text-[10px] font-medium`}>{formatLabels[f]}</span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-1">
              {(Object.keys(formatLabels) as FormatKey[]).map((f) => (
                <button key={f} className={`rounded-lg px-4 py-2 text-sm font-semibold font-display transition ${props.activeFormat === f ? "bg-[#1A1A1A] text-white" : "text-muted hover:text-on-surface hover:bg-sunken"}`} onClick={() => props.setActiveFormat(f)}>{formatLabels[f]}</button>
              ))}
            </div>
            <StatusBadge status={props.activeItem.status} />
          </div>

          {props.canManage && (
            <label className={`mb-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition ${dragActive ? "border-accent bg-accent-subtle" : "border-outline"} ${props.uploadingMedia ? "cursor-wait opacity-60" : "hover:border-accent/50"}`}
              onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }} onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }} onDragOver={(e) => e.preventDefault()}
              onDrop={async (e: DragEvent<HTMLLabelElement>) => { e.preventDefault(); setDragActive(false); if (props.canManage && !props.uploadingMedia) await props.uploadFiles(Array.from(e.dataTransfer.files)); }}>
              <span className="text-accent"><Ic d={icons.upload} size={28} /></span>
              <span className="mt-2 text-sm font-semibold font-display">{props.uploadingMedia ? "Enviando..." : "Arraste midias aqui"}</span>
              <span className="mt-0.5 text-xs text-muted">{props.uploadingMedia ? "Aguarde." : "ou clique para selecionar"}</span>
              {props.uploadingMedia && <span className="loading-dot mt-3 text-accent" />}
              <input className="sr-only" disabled={props.uploadingMedia} multiple type="file" accept="image/*,video/*" onChange={async (e) => { const input = e.currentTarget; await props.uploadFiles(input.files); input.value = ""; }} />
            </label>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="grid gap-3 sm:grid-cols-2">
              {props.activeItem.media.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-outline p-12 text-center">
                  <span className="text-muted"><Ic d={icons.image} size={36} /></span>
                  <p className="mt-2 text-sm text-muted">Nenhuma midia</p>
                </div>
              ) : props.activeItem.media.map((m) => (
                <article key={m.id} className="card-flush relative group">
                  {props.canManage && (
                    <button className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition hover:bg-red-600" onClick={() => props.deleteMedia(m.id)} title="Remover midia">
                      <Ic d={icons.x} size={14} />
                    </button>
                  )}
                  <div className="flex aspect-[4/5] items-center justify-center bg-sunken">
                    {m.type === "image" ? <img alt={m.name} className="h-full w-full object-contain" src={m.url} /> : <video className="h-full w-full object-contain" controls src={m.url} />}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-xs font-semibold">{m.name}</p>
                    <textarea className="field mt-2 min-h-14 text-xs" defaultValue={m.imageNotes} disabled={!props.canManage} placeholder="Obs. da midia" onBlur={(e) => props.saveMediaNotes(m.id, e.target.value)} />
                  </div>
                </article>
              ))}
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted font-display">Copy</span>
                <textarea className="field mt-1.5 min-h-28" defaultValue={props.activeItem.copy} disabled={!props.canManage} key={`${props.activeItem.id}-c`} onBlur={(e) => props.saveFormat({ copy: e.target.value })} placeholder="Texto do post" />
              </label>
              <textarea className="field min-h-16 text-sm" defaultValue={props.activeItem.copyNotes} disabled={!props.canManage} key={`${props.activeItem.id}-cn`} onBlur={(e) => props.saveFormat({ copyNotes: e.target.value })} placeholder="Obs. do texto" />
              <textarea className="field min-h-16 text-sm" defaultValue={props.activeItem.teamNotes} disabled={!props.canManage} key={`${props.activeItem.id}-tn`} onBlur={(e) => props.saveFormat({ teamNotes: e.target.value })} placeholder="Obs. interna (equipe)" />
              <div className="grid grid-cols-2 gap-2">
                <button className="btn btn-success text-sm" onClick={() => props.setStatus("aprovado")}><Ic d={icons.check} size={15} /> Aprovar</button>
                <button className="btn btn-destructive text-sm" onClick={() => props.setStatus("alteracao")}><Ic d={icons.x} size={15} /> Alterar</button>
              </div>
              {props.canManage && <button className="btn btn-outline w-full text-sm" onClick={() => props.setStatus("em_revisao")}>Enviar para revisao</button>}
            </div>
          </div>
        </div>
      </section>

      <aside>
        <div className="card">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-accent"><Ic d={icons.msg} size={16} /></span>
            <h3 className="font-display text-sm font-semibold">Comunicacao</h3>
          </div>
          <div className="max-h-[380px] space-y-2 overflow-auto pr-1">
            {props.activeItem.comments.length === 0 ? (
              <p className="rounded-xl bg-sunken p-4 text-center text-xs text-muted">Nenhuma mensagem.</p>
            ) : props.activeItem.comments.map((c) => (
              <div key={c.id} className="rounded-xl bg-sunken p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-accent">{c.author}</p>
                  <span className="text-[10px] text-muted capitalize">{c.role}</span>
                </div>
                <p className="mt-1 text-sm leading-5">{c.text}</p>
              </div>
            ))}
          </div>
          <textarea className="field mt-3 min-h-16" placeholder="Mensagem..." value={props.commentDraft} onChange={(e) => props.setCommentDraft(e.target.value)} />
          <button className="btn btn-primary mt-2 w-full" onClick={props.addComment}><Ic d={icons.send} size={15} /> Enviar</button>
        </div>
      </aside>
    </div>
  );
}

function NewProjectView(props: { clients: Client[]; newProjectName: string; newProjectPeriod: string; newProjectClientId: string; newProjectCount: number; createProject: () => void; setNewProjectName: (v: string) => void; setNewProjectPeriod: (v: string) => void; setNewProjectClientId: (v: string) => void; setNewProjectCount: (v: number) => void }) {
  return (
    <div className="animate-in mx-auto max-w-xl space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">Novo projeto</h2>
        <p className="mt-1 text-sm text-secondary">Crie um feed ou campanha para um cliente.</p>
      </div>
      <div className="card">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-[11px] font-semibold uppercase tracking-widest text-muted font-display">Nome</span><input className="field mt-1.5" placeholder="Ex.: Rede social Agosto" value={props.newProjectName} onChange={(e) => props.setNewProjectName(e.target.value)} /></label>
          <label className="block"><span className="text-[11px] font-semibold uppercase tracking-widest text-muted font-display">Periodo</span><input className="field mt-1.5" placeholder="Ex.: Agosto 2026" value={props.newProjectPeriod} onChange={(e) => props.setNewProjectPeriod(e.target.value)} /></label>
          <label className="block"><span className="text-[11px] font-semibold uppercase tracking-widest text-muted font-display">Cliente</span><select className="field mt-1.5" value={props.newProjectClientId} onChange={(e) => props.setNewProjectClientId(e.target.value)}>{props.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="block"><span className="text-[11px] font-semibold uppercase tracking-widest text-muted font-display">Qtd. posts</span><input className="field mt-1.5" type="number" min={1} max={120} value={props.newProjectCount} onChange={(e) => props.setNewProjectCount(Number(e.target.value))} /></label>
        </div>
        <button className="btn btn-primary mt-5" onClick={props.createProject}>Criar projeto</button>
      </div>
    </div>
  );
}

function UsersView({ clients, users, newUser, setNewUser, createUser, deleteUser, updateUser, newClientName, newClientTag, setNewClientName, setNewClientTag, createClient }: { clients: Client[]; users: User[]; newUser: { name: string; email: string; password: string; role: Role; clientId: string }; setNewUser: (u: { name: string; email: string; password: string; role: Role; clientId: string }) => void; createUser: () => void; deleteUser: (id: string) => void; updateUser: (data: Record<string, unknown>) => Promise<unknown>; newClientName: string; newClientTag: string; setNewClientName: (v: string) => void; setNewClientTag: (v: string) => void; createClient: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", password: "", role: "cliente" as Role, clientId: "" });

  function startEdit(u: User) {
    setEditingId(u.id);
    setEditForm({ name: u.name, email: u.email, password: "", role: u.role, clientId: u.clientId ?? clients[0]?.id ?? "" });
  }

  async function saveEdit() {
    if (!editingId) return;
    await updateUser({ userId: editingId, name: editForm.name, email: editForm.email, password: editForm.password || undefined, role: editForm.role, clientId: editForm.clientId });
    setEditingId(null);
  }

  return (
    <div className="animate-in grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="card">
          <h3 className="mb-3 font-display font-semibold text-sm">Novo cliente</h3>
          <div className="space-y-3">
            <input className="field" placeholder="Nome do cliente" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
            <input className="field" placeholder="Tag (ex.: cliente-acai)" value={newClientTag} onChange={(e) => setNewClientTag(e.target.value)} />
            <button className="btn btn-primary w-full" onClick={createClient}>Criar cliente</button>
          </div>
        </div>
        <div className="card">
          <h3 className="mb-3 font-display font-semibold text-sm">Novo acesso</h3>
          <div className="space-y-3">
            <input className="field" placeholder="Nome" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
            <input className="field" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
            <input className="field" placeholder="Senha" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
            <select className="field" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}><option value="cliente">Cliente</option><option value="gestor">Gestor</option><option value="admin">Admin</option></select>
            {newUser.role === "cliente" && <select className="field" value={newUser.clientId} onChange={(e) => setNewUser({ ...newUser, clientId: e.target.value })}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
            <button className="btn btn-primary w-full" onClick={createUser}>Criar usuario</button>
          </div>
        </div>
      </div>
      <div className="card">
        <h3 className="mb-1 font-display font-semibold text-sm">Usuarios</h3>
        <p className="mb-4 text-[11px] text-muted">Clientes: {clients.map((c) => c.name).join(", ")}</p>
        <div className="divide-y divide-outline rounded-xl border border-outline overflow-hidden">
          {users.map((u) => (
            <div key={u.id}>
              {editingId === u.id ? (
                <div className="space-y-3 bg-sunken p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input className="field" placeholder="Nome" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    <input className="field" placeholder="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                    <input className="field" placeholder="Nova senha (vazio = manter)" type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
                    <select className="field" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}><option value="cliente">Cliente</option><option value="gestor">Gestor</option><option value="admin">Admin</option></select>
                    {editForm.role === "cliente" && <select className="field sm:col-span-2" value={editForm.clientId} onChange={(e) => setEditForm({ ...editForm, clientId: e.target.value })}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-primary text-xs" onClick={saveEdit}>Salvar</button>
                    <button className="btn btn-outline text-xs" onClick={() => setEditingId(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 text-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF6A13] text-xs font-bold text-white">{u.name.slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{u.name}</p>
                    <p className="text-[11px] text-muted truncate">{u.email}</p>
                  </div>
                  <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-[11px] font-medium text-accent capitalize">{u.role}</span>
                  {u.clientId && <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-medium text-muted">{clients.find((c) => c.id === u.clientId)?.name}</span>}
                  <button className="btn btn-outline text-xs py-1 px-2" onClick={() => startEdit(u)}>Editar</button>
                  <button className="btn btn-danger text-xs py-1 px-2" onClick={() => deleteUser(u.id)}>Apagar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsView({ darkMode, setDarkMode, uploadProfilePhoto, user }: { darkMode: boolean; setDarkMode: (v: boolean) => void; uploadProfilePhoto: (f: File | null) => void; user: User }) {
  return (
    <div className="animate-in grid gap-4 sm:grid-cols-2">
      <div className="card">
        <h3 className="mb-4 font-display font-semibold text-sm">Perfil</h3>
        <div className="flex items-center gap-5">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FF6A13] text-xl font-bold text-white ring-4 ring-outline">{user.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <p className="font-display text-lg font-bold">{user.name}</p>
            <p className="text-sm text-secondary">{user.email}</p>
            <label className="btn btn-outline mt-3 cursor-pointer text-xs">Trocar foto<input className="sr-only" type="file" accept="image/*" onChange={(e) => uploadProfilePhoto(e.target.files?.[0] ?? null)} /></label>
          </div>
        </div>
      </div>
      <div className="card">
        <h3 className="mb-4 font-display font-semibold text-sm">Aparencia</h3>
        <p className="text-sm text-secondary leading-6">Alterne entre modo claro e escuro.</p>
        <button className="btn btn-primary mt-4" onClick={() => setDarkMode(!darkMode)}><Ic d={darkMode ? icons.sun : icons.moon} size={16} />{darkMode ? "Modo claro" : "Modo escuro"}</button>
      </div>
      <div className="card sm:col-span-2">
        <h3 className="mb-4 font-display font-semibold text-sm">Permissoes</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {[{ t: "Admin", d: "Cria usuarios, projetos e acessa todos os clientes." }, { t: "Gestor", d: "Cria projetos, sobe arquivos e edita copies." }, { t: "Cliente", d: "Ve seus projetos, aprova ou pede alteracao." }].map((p) => (
            <div key={p.t} className="rounded-xl bg-sunken p-4"><p className="font-display text-sm font-semibold">{p.t}</p><p className="mt-1 text-xs text-secondary leading-5">{p.d}</p></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ApprovalStatus }) {
  return <span className={`status-${status} rounded-full px-3 py-1 text-xs font-semibold`}>{statusLabels[status]}</span>;
}

function viewTitle(view: View) {
  if (view === "projetos") return "Projetos";
  if (view === "novoProjeto") return "Novo projeto";
  if (view === "usuarios") return "Usuarios e acessos";
  if (view === "configuracoes") return "Configuracoes";
  return "Home";
}
