"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type TouchEvent as ReactTouchEvent } from "react";

type Role = "admin" | "gestor" | "cliente";
type View = "home" | "projetos" | "novoProjeto" | "usuarios" | "configuracoes";
type FormatKey = "feed" | "story" | "video";
type ApprovalStatus = "rascunho" | "em_revisao" | "alteracao" | "aprovado";

type User = { id: string; name: string; email: string; password?: string; role: Role; clientId: string | null; avatarUrl: string | null };
type Client = { id: string; name: string; tag: string };
type MediaAsset = { id: string; name: string; type: "image" | "video"; url: string; imageNotes: string };
type Comment = { id: string; author: string; role: Role; text: string; createdAt?: string };
type FormatItem = { id: string; status: ApprovalStatus; copy: string; copyNotes: string; teamNotes: string; media: MediaAsset[]; comments: Comment[] };
type Post = { id: string; number: number; title: string; formats: Record<FormatKey, FormatItem> };
type Project = { id: string; clientId: string; name: string; period: string; postCount: number; posts: Post[] };
type Notification = { id: string; type: string; title: string; body: string; projectId: string | null; postId: string | null; isRead: boolean; createdAt: string };
type AppData = { user: User | null; users: User[]; clients: Client[]; projects: Project[]; notifications: Notification[] };

const emptyData: AppData = { user: null, users: [], clients: [], projects: [], notifications: [] };
const formatLabels: Record<FormatKey, string> = { feed: "Feed", story: "Story", video: "Video/Reels" };
const statusLabels: Record<ApprovalStatus, string> = { rascunho: "Rascunho", em_revisao: "Em revisão", alteracao: "Alteração", aprovado: "Aprovado" };

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
  edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  close: "M18 6L6 18M6 6l12 12",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  chevronLeft: "M15 18l-6-6 6-6",
  chevronRight: "M9 18l6-6-6-6",
  layers: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  bell: "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
  download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
};

const navItems: Array<{ id: View; label: string; icon: string; managerOnly?: boolean }> = [
  { id: "home", label: "Home", icon: "home" },
  { id: "projetos", label: "Projetos", icon: "folder" },
  { id: "usuarios", label: "Usuários", icon: "users", managerOnly: true },
  { id: "configuracoes", label: "Config.", icon: "settings" },
];

export default function Home() {
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string; msg: string; onConfirm: () => void } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string, type: "success" | "error" | "info" = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  const canManage = data.user?.role === "admin" || data.user?.role === "gestor";
  const activeProject = data.projects.find((p) => p.id === activeProjectId) ?? data.projects[0];
  const activePost = activeProject?.posts.find((p) => p.id === activePostId) ?? activeProject?.posts[0];
  const activeItem = activePost?.formats[activeFormat];
  const activeClient = data.clients.find((c) => c.id === activeProject?.clientId);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setMenuOpen(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMenuOpen(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!activeProjectId && data.projects[0]) setActiveProjectId(data.projects[0].id);
    if (!activePostId && data.projects[0]?.posts[0]) setActivePostId(data.projects[0].posts[0].id);
    if (!newProjectClientId && data.clients[0]) setNewProjectClientId(data.clients[0].id);
    if (!newUser.clientId && data.clients[0]) setNewUser((u) => ({ ...u, clientId: data.clients[0].id }));
  }, [activePostId, activeProjectId, data.clients, data.projects, newProjectClientId, newUser.clientId]);

  function navigate(view: View) {
    setActiveView(view);
    setMobileMenuOpen(false);
  }

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
    if (!res.ok) { setError(d.error ?? "Não foi possível salvar."); return null; }
    if (d.projects || d.user !== undefined) setData(d);
    return d;
  }

  async function login() { const d = await action("login", { email: loginEmail, password: loginPassword }); if (d?.user) { setActiveView("home"); showToast("Login realizado com sucesso!"); } }
  async function logout() { await action("logout"); setData(emptyData); setActiveView("home"); showToast("Você saiu do painel.", "info"); }

  async function createProject() {
    const d = await action("createProject", { name: newProjectName, period: newProjectPeriod || newProjectName, clientId: newProjectClientId, postCount: newProjectCount });
    if (d) { setNewProjectName(""); setNewProjectPeriod(""); setActiveView("projetos"); showToast("Projeto criado com sucesso!"); }
  }

  async function createPost() {
    if (!activeProject || postMutation) return;
    setPostMutation("create");
    try { const d = await action("createPost", { projectId: activeProject.id }); if (d?.createdPostId) { setActivePostId(String(d.createdPostId)); showToast("Post criado!"); } } finally { setPostMutation(null); }
  }

  function deletePost() {
    if (!activePost || !activeProject || postMutation) return;
    setConfirmModal({ title: "Apagar post", msg: `Tem certeza que deseja apagar "${activePost.title}"? Isso não pode ser desfeito.`, onConfirm: async () => {
      setConfirmModal(null); setPostMutation("delete");
      try {
        const d = await action("deletePost", { postId: activePost.id });
        if (d?.projects) { const np = d.projects.find((p: Project) => p.id === activeProject.id); setActivePostId(np?.posts[0]?.id ?? ""); }
        showToast("Post apagado.", "info");
      } finally { setPostMutation(null); }
    }});
  }

  async function createUser() { const d = await action("createUser", newUser); if (d) { setNewUser({ name: "", email: "", password: "", role: "cliente", clientId: data.clients[0]?.id ?? "" }); showToast("Usuário criado com sucesso!"); } }
  function deleteUser(userId: string) {
    const u = data.users.find((x) => x.id === userId);
    setConfirmModal({ title: "Apagar usuário", msg: `Tem certeza que deseja apagar "${u?.name ?? "este usuário"}"? Isso não pode ser desfeito.`, onConfirm: async () => { setConfirmModal(null); await action("deleteUser", { userId }); showToast("Usuário apagado.", "info"); } });
  }
  async function createClient() { const d = await action("createClient", { name: newClientName, tag: newClientTag }); if (d) { setNewClientName(""); setNewClientTag(""); showToast("Cliente criado com sucesso!"); } }

  async function uploadFiles(files: FileList | File[] | null) {
    if (!files || !activeItem || uploadingMedia) return;
    const sel = Array.from(files).filter(isMediaFile);
    if (sel.length === 0) { setError("Envie imagens ou videos."); return; }
    setError(""); setUploadingMedia(true);
    const form = new FormData(); form.append("formatId", activeItem.id); sel.forEach((f) => form.append("files", f));
    try { const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: form }); const r = await res.json(); if (!res.ok) { setError(r.error ?? "Erro no upload."); return; } await refresh(); showToast(`${sel.length} arquivo(s) enviado(s)!`); } finally { setUploadingMedia(false); }
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
    if (fields.status && fields.status !== activeItem.status) showToast(`Status alterado para ${statusLabels[fields.status]}.`);
  }

  async function addComment() {
    if (!activeItem || !commentDraft.trim()) return;
    const d = await action("addComment", { formatId: activeItem.id, text: commentDraft }); if (d) { setCommentDraft(""); showToast("Mensagem enviada!"); }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen min-h-dvh items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <A1Logo className="h-12 w-auto" />
          <span className="loading-dot text-accent" style={{ width: 24, height: 24, borderWidth: 3 }} />
        </div>
      </main>
    );
  }

  if (!data.user) {
    return (
      <main className={`flex min-h-screen min-h-dvh flex-col lg:flex-row ${darkMode ? "dark" : ""}`}>
        <div className="hidden flex-1 flex-col justify-between bg-[#1A1A1A] p-8 text-white lg:flex lg:p-16 overflow-hidden relative">
          <div className="login-bg-glow" />
          <A1Logo className="h-10 w-auto self-start login-fade-in" white />
          <div className="max-w-lg">
            <h1 className="font-display text-[3.5rem] font-bold leading-[1.05] tracking-tight login-slide-up">
              Gerencie posts.<br />
              <span className="text-[#FF6A13] login-slide-up-delay">Aprove rapido.</span>
            </h1>
          </div>
          <div />
        </div>

        <div className="flex flex-1 items-center justify-center bg-surface text-on-surface p-6 sm:p-8">
          <form className="w-full max-w-sm animate-in" onSubmit={(e) => { e.preventDefault(); login(); }}>
            <div className="mb-8 lg:hidden flex flex-col items-center gap-3">
              <A1Logo className="h-9 w-auto" />
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Entrar</h2>
            <p className="mt-1.5 text-sm text-secondary">Acesse o painel do seu projeto.</p>
            <label className="mt-8 block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Email</span>
              <input className="field mt-1.5" type="email" autoComplete="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
            </label>
            <label className="mt-4 block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Senha</span>
              <div className="relative mt-1.5">
                <input className="field pr-10" type={showLoginPassword ? "text" : "password"} autoComplete="current-password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-on-surface transition-colors" onClick={() => setShowLoginPassword(!showLoginPassword)} aria-label={showLoginPassword ? "Ocultar senha" : "Mostrar senha"}>
                  {showLoginPassword ? (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>)}
                </button>
              </div>
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
      <div className="flex min-h-screen min-h-dvh bg-surface text-on-surface">
        {/* Mobile backdrop */}
        <div className={`sidebar-backdrop ${mobileMenuOpen ? "visible" : ""} md:hidden`} onClick={() => setMobileMenuOpen(false)} />

        {/* Sidebar */}
        <aside className={`sidebar ${menuOpen ? "" : "collapsed"} ${mobileMenuOpen ? "mobile-open" : ""}`}>
          <div className="flex flex-col gap-0.5 p-3">
            <div className={`mb-3 flex items-center ${menuOpen || mobileMenuOpen ? "justify-between" : "justify-center"} px-1 py-3`}>
              <A1Logo className={menuOpen || mobileMenuOpen ? "h-7 w-auto" : "h-6 w-auto"} white />
              <button className="rounded-lg p-1.5 text-[#666] hover:bg-[#262626] hover:text-white transition hidden md:block" onClick={() => setMenuOpen((o) => !o)}>
                <Ic d={icons.menu} size={17} />
              </button>
              <button className="rounded-lg p-1.5 text-[#666] hover:bg-[#262626] hover:text-white transition md:hidden" onClick={() => setMobileMenuOpen(false)}>
                <Ic d={icons.close} size={17} />
              </button>
            </div>
            {canManage && (
              <button
                className={`mb-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold font-display bg-[#FF6A13] text-white hover:bg-[#e55d0e] transition ${menuOpen || mobileMenuOpen ? "" : "justify-center px-0"}`}
                onClick={() => navigate("novoProjeto")}
              >
                <Ic d={icons.plus} size={16} />
                {(menuOpen || mobileMenuOpen) && <span>Novo projeto</span>}
              </button>
            )}
            <div className="mt-1 space-y-0.5">
              {navItems.filter((v) => !v.managerOnly || canManage).map((v) => (
                <button key={v.id} className={`sidebar-link ${activeView === v.id ? "active" : ""} ${menuOpen || mobileMenuOpen ? "" : "justify-center px-0 gap-0"}`} onClick={() => navigate(v.id)}>
                  <Ic d={icons[v.icon as keyof typeof icons]} size={18} />
                  {(menuOpen || mobileMenuOpen) && <span>{v.label}</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-auto border-t border-[#262626] p-3">
            <div className={`flex items-center gap-2.5 ${menuOpen || mobileMenuOpen ? "" : "justify-center"}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF6A13] text-xs font-bold text-white">
                {data.user.name.slice(0, 2).toUpperCase()}
              </span>
              {(menuOpen || mobileMenuOpen) && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{data.user.name}</p>
                  <p className="truncate text-[11px] capitalize text-[#666]">{data.user.role}</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-outline bg-raised px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <button className="rounded-lg p-1.5 text-secondary hover:text-on-surface hover:bg-sunken transition md:hidden" onClick={() => setMobileMenuOpen(true)}>
                <Ic d={icons.menu} size={20} />
              </button>
              <h1 className="font-display text-base font-bold sm:text-lg">{viewTitle(activeView)}</h1>
            </div>
            <div className="flex items-center gap-1">
              <div className="relative">
                <button className="btn btn-ghost text-xs p-2 relative" onClick={() => { setShowNotifications((v) => !v); if (!showNotifications) action("markNotificationsRead"); }}>
                  <Ic d={icons.bell} size={16} />
                  {data.notifications.filter((n) => !n.isRead).length > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-bold text-white leading-none">{data.notifications.filter((n) => !n.isRead).length}</span>
                  )}
                </button>
                {showNotifications && <NotificationPanel notifications={data.notifications} onClose={() => setShowNotifications(false)} onNavigate={(projectId, postId) => { setActiveProjectId(projectId); setActivePostId(postId); navigate("projetos"); setShowNotifications(false); }} />}
              </div>
              <button className="btn btn-ghost text-xs p-2" onClick={() => setDarkMode((v) => !v)}>
                <Ic d={darkMode ? icons.sun : icons.moon} size={16} />
              </button>
              <button className="btn btn-ghost text-xs p-2" onClick={logout}>
                <Ic d={icons.logout} size={16} />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </header>

          {/* Content */}
          <section className="flex-1 overflow-auto p-4 sm:p-6">
            {error && <div className="mb-4 rounded-xl bg-[var(--danger-bg)] px-4 py-3 text-sm font-medium text-[var(--danger-text)]">{error}</div>}
            {activeView === "home" && <HomeView data={data} canManage={canManage} setActiveView={navigate} setActiveProjectId={setActiveProjectId} setActivePostId={setActivePostId} />}
            {activeView === "projetos" && activeProject && activePost && activeItem && (
              <ProjectsView activeClient={activeClient} activeFormat={activeFormat} activeItem={activeItem} activePost={activePost} activeProject={activeProject} canManage={canManage} createPost={createPost} deletePost={deletePost} postMutation={postMutation} projects={data.projects} clients={data.clients} uploadingMedia={uploadingMedia} setActiveFormat={setActiveFormat} setActivePostId={setActivePostId} setActiveProjectId={setActiveProjectId} uploadFiles={uploadFiles} saveFormat={saveFormat} savePostTitle={(title) => action("updatePost", { postId: activePost.id, title })} saveMediaNotes={(mediaId, imageNotes) => action("updateMediaNotes", { mediaId, imageNotes })} deleteMedia={(mediaId) => action("deleteMedia", { mediaId })} setStatus={(status) => saveFormat({ status })} commentDraft={commentDraft} setCommentDraft={setCommentDraft} addComment={addComment} userRole={data.user.role} />
            )}
            {activeView === "novoProjeto" && canManage && (
              <NewProjectView clients={data.clients} createProject={createProject} newProjectClientId={newProjectClientId} newProjectCount={newProjectCount} newProjectName={newProjectName} newProjectPeriod={newProjectPeriod} setNewProjectClientId={setNewProjectClientId} setNewProjectCount={setNewProjectCount} setNewProjectName={setNewProjectName} setNewProjectPeriod={setNewProjectPeriod} />
            )}
            {activeView === "usuarios" && canManage && (
              <UsersView clients={data.clients} createUser={createUser} createClient={createClient} deleteUser={deleteUser} updateUser={(payload) => action("updateUser", payload)} newClientName={newClientName} newClientTag={newClientTag} newUser={newUser} setNewClientName={setNewClientName} setNewClientTag={setNewClientTag} setNewUser={setNewUser} users={data.users} />
            )}
            {activeView === "configuracoes" && <SettingsView darkMode={darkMode} setDarkMode={setDarkMode} uploadProfilePhoto={uploadProfilePhoto} user={data.user} />}
          </section>

          {/* Footer */}
          <footer className="border-t border-outline bg-raised px-4 py-3 sm:px-6 flex items-center justify-between">
            <A1Logo className="h-4 w-auto opacity-40" />
            <span className="text-[10px] sm:text-[11px] text-muted">Criatividade com estratégia.</span>
          </footer>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast-container ${toast.type === "success" ? "toast-success" : toast.type === "error" ? "toast-error" : "toast-info"}`} onClick={() => setToast(null)}>
          <Ic d={toast.type === "success" ? icons.check : toast.type === "error" ? icons.x : icons.bell} size={16} />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="confirm-overlay" onClick={() => setConfirmModal(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg">{confirmModal.title}</h3>
            <p className="mt-2 text-sm text-secondary">{confirmModal.msg}</p>
            <div className="mt-5 flex gap-3 justify-end">
              <button className="btn btn-outline text-sm" onClick={() => setConfirmModal(null)}>Cancelar</button>
              <button className="btn btn-danger text-sm" onClick={confirmModal.onConfirm}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ──────────────────── HOME ──────────────────── */

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
        <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight">Bem-vindo de volta</h2>
        <p className="mt-1 text-sm text-secondary">Acompanhe seus projetos e aprovações.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Metric label="Clientes" value={data.clients.length} />
        <Metric label="Projetos" value={data.projects.length} />
        <Metric label="Posts totais" value={postCount} />
        <Metric label="Aprovados" value={fmts.filter((f) => f.status === "aprovado").length} accent />
      </div>
      {grouped.map((g) => (
        <div key={g.client.id}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display font-semibold text-sm sm:text-base">{g.client.name}</h3>
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
                <ProjectProgress posts={p.posts} />
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
      <p className={`font-display text-2xl sm:text-3xl font-bold tracking-tight ${accent ? "text-accent" : ""}`}>{value}</p>
      <p className="mt-0.5 text-[11px] sm:text-xs text-muted">{label}</p>
    </div>
  );
}

function ProjectProgress({ posts }: { posts: Post[] }) {
  const total = posts.length * 3;
  if (total === 0) return null;
  const approved = posts.reduce((s, p) => s + Object.values(p.formats).filter((f) => f.status === "aprovado").length, 0);
  const pct = Math.round((approved / total) * 100);
  return (
    <div className="mt-2.5">
      <div className="flex items-center justify-between text-[10px] text-muted mb-1">
        <span>{approved}/{total} aprovados</span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-sunken overflow-hidden">
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ──────────────────── PROJECTS ──────────────────── */

function ProjectsView(props: {
  activeClient?: Client; activeFormat: FormatKey; activeItem: FormatItem; activePost: Post; activeProject: Project; canManage: boolean; projects: Project[]; clients: Client[];
  commentDraft: string; createPost: () => Promise<void>; deletePost: () => void; postMutation: "create" | "delete" | null; uploadingMedia: boolean; addComment: () => void;
  saveFormat: (fields: Partial<FormatItem>) => void; savePostTitle: (title: string) => void; saveMediaNotes: (mediaId: string, imageNotes: string) => void; deleteMedia: (mediaId: string) => void;
  setActiveFormat: (f: FormatKey) => void; setActivePostId: (id: string) => void; setActiveProjectId: (id: string) => void; setStatus: (s: ApprovalStatus) => void;
  setCommentDraft: (v: string) => void; uploadFiles: (files: FileList | File[] | null) => Promise<void>; userRole: Role;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [showProjectList, setShowProjectList] = useState(false);
  const [showFeedPreview, setShowFeedPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deletingMedia, setDeletingMedia] = useState(false);

  const totalMedia = props.activeProject.posts.reduce((sum, p) => sum + Object.values(p.formats).reduce((s, f) => s + f.media.length, 0), 0);

  async function downloadProject() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/download-project?projectId=${props.activeProject.id}`, { credentials: "include" });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${props.activeProject.name}.zip`; a.click();
      URL.revokeObjectURL(url);
    } finally { setDownloading(false); }
  }

  async function deleteAllMedia() {
    if (!confirm(`Apagar todas as ${totalMedia} mídias de "${props.activeProject.name}"? Isso não pode ser desfeito.`)) return;
    setDeletingMedia(true);
    try {
      await fetch("/api/app", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ action: "deleteProjectMedia", projectId: props.activeProject.id }) });
      window.location.reload();
    } finally { setDeletingMedia(false); }
  }

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
    <div className="animate-in space-y-4 lg:space-y-0 lg:grid lg:gap-5 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
      {/* Project list - collapsible on mobile */}
      <div className="lg:hidden">
        <button className="card w-full text-left flex items-center justify-between" onClick={() => setShowProjectList(!showProjectList)}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted font-display">{props.activeClient?.name}</p>
            <p className="font-display font-semibold text-sm mt-0.5">{props.activeProject.name}</p>
          </div>
          <Ic d={showProjectList ? icons.x : icons.folder} size={18} />
        </button>
        {showProjectList && (
          <div className="mt-2 card max-h-[50vh] overflow-auto space-y-3">
            {grouped.map((g) => (
              <div key={g.client.id}>
                <h3 className="px-1 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted font-display">{g.client.name}</h3>
                <div className="space-y-1">
                  {g.projects.map((p) => (
                    <button key={p.id} className={`w-full rounded-xl p-2.5 text-left transition ${p.id === props.activeProject.id ? "bg-accent-subtle border border-accent/30" : "hover:bg-sunken border border-transparent"}`} onClick={() => { props.setActiveProjectId(p.id); props.setActivePostId(p.posts[0]?.id ?? ""); setShowProjectList(false); }}>
                      <span className={`block text-sm font-semibold ${p.id === props.activeProject.id ? "text-accent" : ""}`}>{p.name}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">{p.period} &middot; {p.posts.length} posts</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Project list - desktop sidebar */}
      <aside className="hidden lg:block space-y-4 max-h-[calc(100vh-140px)] overflow-auto pr-1">
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

      {/* Main content area */}
      <div className="space-y-4">
        {/* Post selector */}
        <div className="card">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted font-display">{props.activeProject.name}</p>
              <input className="field mt-1 max-w-full sm:max-w-[280px] font-display font-semibold" defaultValue={props.activePost.title} disabled={!props.canManage} key={props.activePost.id} onBlur={(e) => props.savePostTitle(e.target.value)} />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-outline text-xs" onClick={() => setShowFeedPreview(true)}><Ic d={icons.grid} size={14} /> Ver feed</button>
              {props.canManage && (
                <>
                  <button className="btn btn-outline text-xs" disabled={downloading || totalMedia === 0} onClick={downloadProject}><Ic d={icons.download} size={14} /> {downloading ? "Baixando..." : "Baixar"}</button>
                  <button className="btn btn-danger text-xs" disabled={deletingMedia || totalMedia === 0} onClick={deleteAllMedia} title="Apagar todas as mídias"><Ic d={icons.trash} size={14} /> Mídias</button>
                  <button className="btn btn-outline text-xs flex-1 sm:flex-none" disabled={props.postMutation !== null} onClick={props.createPost}><Ic d={icons.plus} size={14} /> Post</button>
                  <button className="btn btn-danger text-xs" disabled={props.postMutation !== null} onClick={props.deletePost}><Ic d={icons.trash} size={14} /></button>
                </>
              )}
            </div>
          </div>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {props.activeProject.posts.map((post) => {
              const statuses = Object.values(post.formats).map((f) => f.status);
              const allApproved = statuses.every((s) => s === "aprovado");
              const hasAlt = statuses.some((s) => s === "alteracao");
              const borderColor = post.id === props.activePost.id ? "border-accent bg-accent-subtle" : allApproved ? "border-l-[3px] border-l-green-500 border-outline" : hasAlt ? "border-l-[3px] border-l-red-400 border-outline" : "border-outline hover:border-accent/40";
              return (
              <button key={post.id} className={`rounded-xl border p-2 sm:p-2.5 text-left transition ${borderColor}`} onClick={() => props.setActivePostId(post.id)}>
                <span className="text-[11px] font-bold text-accent">#{String(post.number).padStart(2, "0")}</span>
                <span className="mt-0.5 block truncate text-[11px] sm:text-xs font-semibold">{post.title}</span>
                <span className="mt-1 flex gap-1 flex-wrap">
                  {(Object.keys(formatLabels) as FormatKey[]).map((f) => (
                    <span key={f} className={`status-${post.formats[f].status} rounded px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium`}>{formatLabels[f]}</span>
                  ))}
                </span>
              </button>
              );
            })}
          </div>
        </div>

        {/* Format tabs + status */}
        <div className="card">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 overflow-x-auto">
              {(Object.keys(formatLabels) as FormatKey[]).map((f) => (
                <button key={f} className={`rounded-lg px-3 sm:px-4 py-2 text-sm font-semibold font-display transition whitespace-nowrap ${props.activeFormat === f ? "bg-[#1A1A1A] text-white" : "text-muted hover:text-on-surface hover:bg-sunken"}`} onClick={() => props.setActiveFormat(f)}>{formatLabels[f]}</button>
              ))}
            </div>
            <StatusBadge status={props.activeItem.status} />
          </div>

          {/* Upload area - gestor only */}
          {props.canManage && (
            <label className={`mb-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 sm:p-8 transition ${dragActive ? "border-accent bg-accent-subtle" : "border-outline"} ${props.uploadingMedia ? "cursor-wait opacity-60" : "hover:border-accent/50"}`}
              onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }} onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }} onDragOver={(e) => e.preventDefault()}
              onDrop={async (e: DragEvent<HTMLLabelElement>) => { e.preventDefault(); setDragActive(false); if (props.canManage && !props.uploadingMedia) await props.uploadFiles(Array.from(e.dataTransfer.files)); }}>
              <span className="text-accent"><Ic d={icons.upload} size={28} /></span>
              <span className="mt-2 text-sm font-semibold font-display">{props.uploadingMedia ? "Enviando..." : "Arraste mídias aqui"}</span>
              <span className="mt-0.5 text-xs text-muted">{props.uploadingMedia ? "Aguarde." : "ou clique para selecionar"}</span>
              {props.uploadingMedia && <span className="loading-dot mt-3 text-accent" />}
              <input className="sr-only" disabled={props.uploadingMedia} multiple type="file" accept="image/*,video/*" onChange={async (e) => { const input = e.currentTarget; await props.uploadFiles(input.files); input.value = ""; }} />
            </label>
          )}

          {/* Media gallery */}
          <div className={`grid gap-3 ${props.activeItem.media.length === 0 ? "" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"}`}>
            {props.activeItem.media.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline p-8 sm:p-12 text-center">
                <span className="text-muted"><Ic d={icons.image} size={36} /></span>
                <p className="mt-2 text-sm text-muted">Nenhuma mídia</p>
              </div>
            ) : props.activeItem.media.map((m) => (
              <article key={m.id} className="card-flush relative group">
                {props.canManage && (
                  <button className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition hover:bg-red-600" onClick={() => props.deleteMedia(m.id)} title="Remover mídia">
                    <Ic d={icons.x} size={14} />
                  </button>
                )}
                <div className="flex aspect-[4/5] items-center justify-center bg-sunken">
                  {m.type === "image" ? <img alt={m.name} className="h-full w-full object-contain" src={m.url} /> : <video className="h-full w-full object-contain" controls src={m.url} />}
                </div>
                <div className="p-3">
                  <p className="truncate text-xs font-semibold">{m.name}</p>
                  {props.canManage && (
                    <textarea className="field mt-2 min-h-14 text-xs" defaultValue={m.imageNotes} placeholder="Obs. da mídia (gestor)" key={`notes-${m.id}`} onBlur={(e) => props.saveMediaNotes(m.id, e.target.value)} />
                  )}
                  {!props.canManage && m.imageNotes && (
                    <p className="mt-2 text-xs text-secondary bg-sunken rounded-lg p-2">{m.imageNotes}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Copy - gestor edits, client reads */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-accent"><Ic d={icons.edit} size={16} /></span>
            <h3 className="font-display text-sm font-semibold">Copy</h3>
          </div>
          <textarea className="field min-h-28" defaultValue={props.activeItem.copy} disabled={!props.canManage} key={`${props.activeItem.id}-c`} onBlur={(e) => props.saveFormat({ copy: e.target.value })} placeholder={props.canManage ? "Escreva o texto do post" : "Nenhuma copy ainda"} />
          {props.canManage && <button className="btn btn-outline w-full text-sm mt-3" onClick={() => props.setStatus("em_revisao")}>Enviar para revisão</button>}
        </div>

        {/* Observacoes - client and gestor can both edit */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-accent"><Ic d={icons.edit} size={16} /></span>
              <h3 className="font-display text-sm font-semibold">Obs. do texto</h3>
            </div>
            <textarea className="field min-h-20 text-sm" defaultValue={props.activeItem.copyNotes} key={`${props.activeItem.id}-cn`} onBlur={(e) => props.saveFormat({ copyNotes: e.target.value })} placeholder="O que precisa mudar no texto?" />
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-accent"><Ic d={icons.image} size={16} /></span>
              <h3 className="font-display text-sm font-semibold">Obs. da imagem</h3>
            </div>
            <textarea className="field min-h-20 text-sm" defaultValue={props.activeItem.teamNotes} key={`${props.activeItem.id}-tn`} onBlur={(e) => props.saveFormat({ teamNotes: e.target.value })} placeholder="O que precisa mudar nas imagens?" />
          </div>
        </div>

        {/* Approval + Communication - visible to ALL (especially clients) */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Approval actions */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-accent"><Ic d={icons.check} size={16} /></span>
              <h3 className="font-display text-sm font-semibold">Aprovação</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-sunken">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted font-display">Status atual:</span>
                <StatusBadge status={props.activeItem.status} />
              </div>
              <div className={`grid gap-2 ${props.canManage ? "grid-cols-3" : "grid-cols-2"}`}>
                <button className="btn btn-success text-sm py-3" onClick={() => props.setStatus("aprovado")}><Ic d={icons.check} size={15} /> Aprovar</button>
                <button className="btn btn-destructive text-sm py-3" onClick={() => props.setStatus("alteracao")}><Ic d={icons.x} size={15} /> Pedir alteração</button>
                {props.canManage && <button className="btn btn-outline text-sm py-3" onClick={() => props.setStatus("em_revisao")}><Ic d={icons.edit} size={15} /> Em revisão</button>}
              </div>
            </div>
          </div>

          {/* Comments / Communication */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-accent"><Ic d={icons.msg} size={16} /></span>
              <h3 className="font-display text-sm font-semibold">Comunicação</h3>
            </div>
            <div className="max-h-[280px] space-y-2 overflow-auto pr-1 mb-3">
              {props.activeItem.comments.length === 0 ? (
                <p className="rounded-xl bg-sunken p-4 text-center text-xs text-muted">Nenhuma mensagem ainda.</p>
              ) : props.activeItem.comments.map((c) => (
                <div key={c.id} className="rounded-xl bg-sunken p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-accent">{c.author}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted capitalize">{c.role}</span>
                      {c.createdAt && <span className="text-[10px] text-muted">{formatDateTime(c.createdAt)}</span>}
                    </div>
                  </div>
                  <p className="mt-1 text-sm leading-5">{c.text}</p>
                </div>
              ))}
            </div>
            <textarea className="field min-h-16" placeholder="Escreva sua mensagem..." value={props.commentDraft} onChange={(e) => props.setCommentDraft(e.target.value)} />
            <button className="btn btn-primary mt-2 w-full" onClick={props.addComment}><Ic d={icons.send} size={15} /> Enviar</button>
          </div>
        </div>
        {showFeedPreview && <FeedPreview posts={props.activeProject.posts} projectName={props.activeProject.name} onClose={() => setShowFeedPreview(false)} />}
      </div>
    </div>
  );
}

/* ──────────────────── FEED PREVIEW ──────────────────── */

function FeedCarouselCell({ media }: { media: MediaAsset[] }) {
  const [idx, setIdx] = useState(0);
  const touchStart = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleTouchStart(e: ReactTouchEvent) { touchStart.current = e.touches[0].clientX; }
  function handleTouchEnd(e: ReactTouchEvent) {
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0 && idx < media.length - 1) setIdx(idx + 1);
      if (diff < 0 && idx > 0) setIdx(idx - 1);
    }
  }

  if (media.length === 0) return (
    <div className="feed-cell bg-sunken flex items-center justify-center">
      <span className="text-muted"><Ic d={icons.image} size={28} /></span>
    </div>
  );

  return (
    <div className="feed-cell relative overflow-hidden group" ref={containerRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="feed-carousel" style={{ transform: `translateX(-${idx * 100}%)` }}>
        {media.map((m) => (
          <div key={m.id} className="feed-carousel-slide">
            {m.type === "image" ? <img src={m.url} alt={m.name} className="h-full w-full object-cover" /> : <video src={m.url} className="h-full w-full object-cover" muted />}
          </div>
        ))}
      </div>
      {media.length > 1 && (
        <>
          {idx > 0 && <button className="feed-nav feed-nav-left opacity-0 group-hover:opacity-100" onClick={() => setIdx(idx - 1)}><Ic d={icons.chevronLeft} size={16} /></button>}
          {idx < media.length - 1 && <button className="feed-nav feed-nav-right opacity-0 group-hover:opacity-100" onClick={() => setIdx(idx + 1)}><Ic d={icons.chevronRight} size={16} /></button>}
          <div className="feed-dots">
            {media.map((_, i) => <span key={i} className={`feed-dot ${i === idx ? "active" : ""}`} />)}
          </div>
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] text-white font-semibold pointer-events-none">
            <Ic d={icons.layers} size={10} /> {idx + 1}/{media.length}
          </div>
        </>
      )}
    </div>
  );
}

const aspectRatios = [
  { label: "4:5", value: "4/5", desc: "1080×1350" },
  { label: "1:1", value: "1/1", desc: "1080×1080" },
  { label: "3:4", value: "3/4", desc: "1080×1440" },
];

function FeedPreview({ posts, projectName, onClose }: { posts: Post[]; projectName: string; onClose: () => void }) {
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [aspectIdx, setAspectIdx] = useState(0);
  const touchStart = useRef(0);

  const feedPosts = posts.map((p) => ({ post: p, media: p.formats.feed.media }));

  function openPost(post: Post) { setSelectedPost(post); setCarouselIdx(0); }

  function handleTouchStart(e: ReactTouchEvent) { touchStart.current = e.touches[0].clientX; }
  function handleTouchEnd(e: ReactTouchEvent) {
    if (!selectedPost) return;
    const media = selectedPost.formats.feed.media;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0 && carouselIdx < media.length - 1) setCarouselIdx(carouselIdx + 1);
      if (diff < 0 && carouselIdx > 0) setCarouselIdx(carouselIdx - 1);
    }
  }

  return (
    <div className="feed-overlay" onClick={onClose}>
      <div className="feed-modal" onClick={(e) => e.stopPropagation()}>
        <div className="feed-modal-header">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#dc2743]">
              <A1Logo className="h-4 w-auto" white />
            </div>
            <div>
              <p className="text-sm font-semibold">{projectName}</p>
              <p className="text-[11px] text-muted">Preview do feed</p>
            </div>
          </div>
          <button className="btn btn-ghost p-2" onClick={onClose}><Ic d={icons.close} size={18} /></button>
        </div>

        <div className="flex items-center justify-center gap-1 py-2 border-b border-[var(--outline)]">
          {aspectRatios.map((ar, i) => (
            <button key={ar.label} className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${aspectIdx === i ? "bg-[#1A1A1A] text-white" : "text-muted hover:text-on-surface hover:bg-sunken"}`} onClick={() => setAspectIdx(i)} title={ar.desc}>{ar.label}</button>
          ))}
        </div>

        <div className="feed-grid" style={{ "--feed-aspect": aspectRatios[aspectIdx].value } as React.CSSProperties}>
          {feedPosts.map(({ post, media }) => (
            <button key={post.id} className="feed-cell-btn" onClick={() => openPost(post)}>
              <FeedCarouselCell media={media} />
              {media.length > 1 && (
                <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-sm bg-black/50 px-1 py-0.5 text-[9px] text-white pointer-events-none z-10">
                  <Ic d={icons.layers} size={9} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {selectedPost && (
        <div className="feed-detail-overlay" onClick={() => setSelectedPost(null)}>
          <div className="feed-detail" onClick={(e) => e.stopPropagation()}>
            <div className="feed-detail-header">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#dc2743]">
                  <A1Logo className="h-4 w-auto" white />
                </div>
                <div>
                  <p className="text-sm font-semibold">{projectName}</p>
                  <p className="text-[11px] text-muted">#{String(selectedPost.number).padStart(2, "0")} &middot; {selectedPost.title}</p>
                </div>
              </div>
              <button className="btn btn-ghost p-2" onClick={() => setSelectedPost(null)}><Ic d={icons.close} size={18} /></button>
            </div>
            <div className="feed-detail-media" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
              {selectedPost.formats.feed.media.length === 0 ? (
                <div className="flex h-full items-center justify-center bg-sunken"><span className="text-muted"><Ic d={icons.image} size={48} /></span></div>
              ) : (
                <>
                  <div className="feed-carousel" style={{ transform: `translateX(-${carouselIdx * 100}%)` }}>
                    {selectedPost.formats.feed.media.map((m) => (
                      <div key={m.id} className="feed-carousel-slide">
                        {m.type === "image" ? <img src={m.url} alt={m.name} className="h-full w-full object-contain bg-black" /> : <video src={m.url} className="h-full w-full object-contain bg-black" controls />}
                      </div>
                    ))}
                  </div>
                  {selectedPost.formats.feed.media.length > 1 && (
                    <>
                      {carouselIdx > 0 && <button className="feed-nav feed-nav-left" onClick={() => setCarouselIdx(carouselIdx - 1)}><Ic d={icons.chevronLeft} size={20} /></button>}
                      {carouselIdx < selectedPost.formats.feed.media.length - 1 && <button className="feed-nav feed-nav-right" onClick={() => setCarouselIdx(carouselIdx + 1)}><Ic d={icons.chevronRight} size={20} /></button>}
                      <div className="feed-dots">
                        {selectedPost.formats.feed.media.map((_, i) => <span key={i} className={`feed-dot ${i === carouselIdx ? "active" : ""}`} />)}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            {selectedPost.formats.feed.copy && (
              <div className="feed-detail-copy">
                <p className="text-sm leading-relaxed"><span className="font-semibold mr-1.5">{projectName.toLowerCase().replace(/\s+/g, "")}</span>{selectedPost.formats.feed.copy}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────── NEW PROJECT ──────────────────── */

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
        <button className="btn btn-primary mt-5 w-full sm:w-auto" onClick={props.createProject}>Criar projeto</button>
      </div>
    </div>
  );
}

/* ──────────────────── USERS ──────────────────── */

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
    <div className="animate-in space-y-5 lg:grid lg:gap-5 lg:grid-cols-[360px_minmax(0,1fr)] lg:space-y-0">
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
            <button className="btn btn-primary w-full" onClick={createUser}>Criar usuário</button>
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
                <div className="space-y-3 bg-sunken p-3 sm:p-4">
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
                <div className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF6A13] text-xs font-bold text-white">{u.name.slice(0, 2).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{u.name}</p>
                      <p className="text-[11px] text-muted truncate">{u.email} · Senha: {u.password ?? "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-12 sm:ml-0">
                    <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-[11px] font-medium text-accent capitalize">{u.role}</span>
                    {u.clientId && <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-medium text-muted">{clients.find((c) => c.id === u.clientId)?.name}</span>}
                    <button className="btn btn-outline text-xs py-1 px-2" onClick={() => startEdit(u)}>Editar</button>
                    <button className="btn btn-danger text-xs py-1 px-2" onClick={() => deleteUser(u.id)}>Apagar</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────── SETTINGS ──────────────────── */

function SettingsView({ darkMode, setDarkMode, uploadProfilePhoto, user }: { darkMode: boolean; setDarkMode: (v: boolean) => void; uploadProfilePhoto: (f: File | null) => void; user: User }) {
  return (
    <div className="animate-in space-y-4 sm:grid sm:gap-4 sm:grid-cols-2 sm:space-y-0">
      <div className="card">
        <h3 className="mb-4 font-display font-semibold text-sm">Perfil</h3>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
          <span className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-[#FF6A13] text-lg sm:text-xl font-bold text-white ring-4 ring-outline">{user.name.slice(0, 2).toUpperCase()}</span>
          <div className="text-center sm:text-left">
            <p className="font-display text-lg font-bold">{user.name}</p>
            <p className="text-sm text-secondary">{user.email}</p>
            <label className="btn btn-outline mt-3 cursor-pointer text-xs">Trocar foto<input className="sr-only" type="file" accept="image/*" onChange={(e) => uploadProfilePhoto(e.target.files?.[0] ?? null)} /></label>
          </div>
        </div>
      </div>
      <div className="card">
        <h3 className="mb-4 font-display font-semibold text-sm">Aparência</h3>
        <p className="text-sm text-secondary leading-6">Alterne entre modo claro e escuro.</p>
        <button className="btn btn-primary mt-4" onClick={() => setDarkMode(!darkMode)}><Ic d={darkMode ? icons.sun : icons.moon} size={16} />{darkMode ? "Modo claro" : "Modo escuro"}</button>
      </div>
      <div className="card sm:col-span-2">
        <h3 className="mb-4 font-display font-semibold text-sm">Permissões</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {[{ t: "Admin", d: "Cria usuários, projetos e acessa todos os clientes." }, { t: "Gestor", d: "Cria projetos, sobe arquivos e edita copies." }, { t: "Cliente", d: "Vê seus projetos, aprova ou pede alteração." }].map((p) => (
            <div key={p.t} className="rounded-xl bg-sunken p-4"><p className="font-display text-sm font-semibold">{p.t}</p><p className="mt-1 text-xs text-secondary leading-5">{p.d}</p></div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────── NOTIFICATIONS ──────────────────── */

function NotificationPanel({ notifications, onClose, onNavigate }: { notifications: Notification[]; onClose: () => void; onNavigate: (projectId: string, postId: string) => void }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const typeIcon: Record<string, string> = { status: icons.check, comment: icons.msg, upload: icons.upload, post: icons.plus };
  const typeColor: Record<string, string> = { status: "text-[var(--success)]", comment: "text-accent", upload: "text-[var(--info)]", post: "text-[var(--warning)]" };

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr + "Z").getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  }

  return (
    <div ref={panelRef} className="notif-panel">
      <div className="notif-header">
        <h3 className="font-display text-sm font-semibold">Notificações</h3>
        <span className="text-[11px] text-muted">{notifications.filter((n) => !n.isRead).length} novas</span>
      </div>
      <div className="notif-list">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted">Nenhuma notificação.</div>
        ) : notifications.map((n) => (
          <button key={n.id} className={`notif-item ${!n.isRead ? "notif-unread" : ""}`} onClick={() => n.projectId && n.postId ? onNavigate(n.projectId, n.postId) : undefined}>
            <span className={`notif-icon ${typeColor[n.type] || "text-muted"}`}>
              <Ic d={typeIcon[n.type] || icons.bell} size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{n.title}</p>
              {n.body && <p className="text-xs text-secondary mt-0.5 line-clamp-2">{n.body}</p>}
            </div>
            <span className="text-[10px] text-muted whitespace-nowrap ml-2">{timeAgo(n.createdAt)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────── HELPERS ──────────────────── */

function formatDateTime(dateStr: string) {
  try {
    const d = new Date(dateStr + (dateStr.includes("Z") ? "" : "Z"));
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function StatusBadge({ status }: { status: ApprovalStatus }) {
  return <span className={`status-${status} rounded-full px-3 py-1 text-xs font-semibold`}>{statusLabels[status]}</span>;
}

function viewTitle(view: View) {
  if (view === "projetos") return "Projetos";
  if (view === "novoProjeto") return "Novo projeto";
  if (view === "usuarios") return "Usuários e acessos";
  if (view === "configuracoes") return "Configurações";
  return "Home";
}
