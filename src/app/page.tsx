"use client";

import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { parseDocument, getFileType } from "@/lib/documentParser";
import MarkdownMessage from "@/components/MarkdownMessage";
import type { ChatSession, ChatMessage } from "@/lib/types";

// ─── Local Storage Helpers ──────────────────────────────────────────────────────

const SESSIONS_KEY = "notebooklm_sessions";
const ACTIVE_SESSION_KEY = "notebooklm_active_session";

function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function loadActiveSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_SESSION_KEY);
}

function saveActiveSessionId(id: string) {
  localStorage.setItem(ACTIVE_SESSION_KEY, id);
}

// ─── Icons (inline SVG) ─────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 12h18M3 6h18M3 18h18" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const loaded = loadSessions();
    setSessions(loaded);
    const activeId = loadActiveSessionId();
    if (activeId && loaded.find((s) => s.id === activeId)) {
      setActiveSessionId(activeId);
    } else if (loaded.length > 0) {
      setActiveSessionId(loaded[0].id);
    }
  }, []);

  // Save sessions whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      saveSessions(sessions);
    }
  }, [sessions]);

  // Save active session ID
  useEffect(() => {
    if (activeSessionId) {
      saveActiveSessionId(activeSessionId);
    }
  }, [activeSessionId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, activeSessionId]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  // ── Session Management ──────────────────────────────────────────────────────

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: uuidv4(),
      name: `Chat ${sessions.length + 1}`,
      createdAt: Date.now(),
      messages: [],
      documents: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const deleteSession = async (sessionId: string) => {
    // Delete vectors from Pinecone
    try {
      await fetch("/api/session", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
    } catch (err) {
      console.error("Failed to delete session from Pinecone:", err);
    }

    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      if (activeSessionId === sessionId) {
        setActiveSessionId(filtered.length > 0 ? filtered[0].id : null);
      }
      if (filtered.length === 0) {
        localStorage.removeItem(SESSIONS_KEY);
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      }
      return filtered;
    });
  };

  const updateSessionMessages = (
    sessionId: string,
    messages: ChatMessage[]
  ) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, messages } : s))
    );
  };

  const addDocumentToSession = (sessionId: string, fileName: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, documents: [...s.documents, fileName] }
          : s
      )
    );
  };

  const renameSession = (sessionId: string, newName: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, name: newName } : s))
    );
  };

  // ── File Upload ─────────────────────────────────────────────────────────────

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSession) return;

    const fileType = getFileType(file);
    if (fileType === "unsupported") {
      setUploadProgress(
        "Unsupported file type. Use PDF, DOCX, CSV, or TXT files."
      );
      return;
    }

    setUploading(true);
    setUploadProgress("Parsing document in browser...");

    try {
      // Step 1: Parse the document client-side
      const text = await parseDocument(file);
      setUploadProgress(
        `Extracted ${text.length.toLocaleString()} characters. Indexing...`
      );

      // Step 2: Send only the text to the server
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          fileName: file.name,
          sessionId: activeSession.id,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      addDocumentToSession(activeSession.id, file.name);

      // Auto-rename session to first document name if it's the default name
      if (activeSession.name.startsWith("Chat ")) {
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        renameSession(
          activeSession.id,
          baseName.length > 30 ? baseName.substring(0, 30) + "..." : baseName
        );
      }

      setUploadProgress(
        `✓ "${file.name}" indexed (${data.chunks} chunks)`
      );
      setTimeout(() => setUploadProgress(""), 4000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      setUploadProgress(`✗ Error: ${message}`);
    } finally {
      setUploading(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // ── Chat ────────────────────────────────────────────────────────────────────

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !activeSession) return;

    const userMessage: ChatMessage = { role: "user", content: query };
    const newMessages = [...activeSession.messages, userMessage];

    const assistantMessage: ChatMessage = { role: "assistant", content: "" };
    updateSessionMessages(activeSession.id, [...newMessages, assistantMessage]);

    setQuery("");
    setLoading(true);

    try {
      const history = activeSession.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          sessionId: activeSession.id,
          history,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Request failed");
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullResponse += chunk;
        updateSessionMessages(activeSession.id, [
          ...newMessages,
          { role: "assistant", content: fullResponse },
        ]);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      updateSessionMessages(activeSession.id, [
        ...newMessages,
        { role: "assistant", content: `⚠️ Error: ${message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0f]">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-72" : "w-0"
        } transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 border-r border-white/[0.06] bg-[#0d0d14] flex flex-col`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <h1 className="text-base font-semibold text-white/90 tracking-tight whitespace-nowrap">
            📓 Mini-NotebookLM
          </h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
            aria-label="Close sidebar"
          >
            <ChevronLeftIcon />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={createNewSession}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-dashed border-white/[0.12] text-white/60 hover:text-white/90 hover:border-violet-500/40 hover:bg-violet-500/[0.06] transition-all text-sm font-medium"
          >
            <PlusIcon />
            <span className="whitespace-nowrap">New Chat</span>
          </button>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          {sessions.length === 0 && (
            <p className="text-white/25 text-xs text-center mt-8 px-4">
              No chats yet. Create one to get started.
            </p>
          )}
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-sm ${
                activeSessionId === session.id
                  ? "bg-violet-500/[0.12] text-white/95 border border-violet-500/20"
                  : "text-white/50 hover:bg-white/[0.04] hover:text-white/75 border border-transparent"
              }`}
              onClick={() => setActiveSessionId(session.id)}
            >
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{session.name}</p>
                {session.documents.length > 0 && (
                  <p className="text-[11px] text-white/30 truncate mt-0.5 flex items-center gap-1">
                    <FileIcon />
                    {session.documents.length} doc
                    {session.documents.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(session.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all flex-shrink-0"
                aria-label="Delete chat"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 border-b border-white/[0.06] flex items-center px-4 gap-3 flex-shrink-0 bg-[#0a0a0f]/80 backdrop-blur-xl">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
              aria-label="Open sidebar"
            >
              <MenuIcon />
            </button>
          )}
          {activeSession ? (
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="text-sm font-medium text-white/80 truncate">
                {activeSession.name}
              </h2>
              {activeSession.documents.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/[0.1] border border-violet-500/20 flex-shrink-0">
                  <FileIcon />
                  <span className="text-[11px] text-violet-300/80 font-medium">
                    {activeSession.documents.length} document
                    {activeSession.documents.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <h2 className="text-sm text-white/40">
              Create a new chat to begin
            </h2>
          )}

          {/* Upload Button in Header */}
          {activeSession && (
            <div className="ml-auto flex items-center gap-3">
              {uploadProgress && (
                <span
                  className={`text-xs ${
                    uploadProgress.startsWith("✗")
                      ? "text-red-400"
                      : uploadProgress.startsWith("✓")
                      ? "text-emerald-400"
                      : "text-white/40"
                  }`}
                >
                  {uploadProgress}
                </span>
              )}
              <label
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                  uploading
                    ? "bg-white/[0.04] text-white/30 cursor-wait"
                    : "bg-white/[0.06] text-white/60 hover:bg-violet-500/[0.12] hover:text-violet-300 border border-white/[0.08] hover:border-violet-500/30"
                }`}
              >
                <UploadIcon />
                <span className="whitespace-nowrap">
                  {uploading ? "Processing..." : "Upload Document"}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.csv,.docx"
                  onChange={handleUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </header>

        {/* Chat Area */}
        {!activeSession ? (
          // Empty State
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-6">📓</div>
              <h2 className="text-2xl font-semibold text-white/90 mb-3 tracking-tight">
                Mini-NotebookLM
              </h2>
              <p className="text-white/40 text-sm mb-8 leading-relaxed">
                Upload PDFs, DOCX, CSV, or text files and chat with your
                documents. Each chat session keeps its documents separate.
              </p>
              <button
                onClick={createNewSession}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition-colors shadow-lg shadow-violet-500/20"
              >
                <PlusIcon />
                Create Your First Chat
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="max-w-3xl mx-auto space-y-5">
                {activeSession.messages.length === 0 && (
                  <div className="text-center py-20">
                    <p className="text-white/25 text-sm mb-2">
                      {activeSession.documents.length === 0
                        ? "Upload a document to get started"
                        : "Ask a question about your documents"}
                    </p>
                    {activeSession.documents.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-2 mt-4">
                        {activeSession.documents.map((doc, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-white/40"
                          >
                            <FileIcon />
                            {doc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeSession.messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] ${
                        msg.role === "user"
                          ? "bg-violet-600/80 text-white px-4 py-3 rounded-2xl rounded-br-md"
                          : "bg-white/[0.04] border border-white/[0.06] px-5 py-4 rounded-2xl rounded-bl-md"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <MarkdownMessage content={msg.content} />
                      ) : (
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white/[0.04] border border-white/[0.06] px-5 py-4 rounded-2xl rounded-bl-md">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 rounded-full bg-violet-400/60 animate-bounce [animation-delay:0ms]" />
                          <span className="w-2 h-2 rounded-full bg-violet-400/60 animate-bounce [animation-delay:150ms]" />
                          <span className="w-2 h-2 rounded-full bg-violet-400/60 animate-bounce [animation-delay:300ms]" />
                        </div>
                        <span className="text-xs text-white/30 ml-1">
                          Thinking...
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div className="border-t border-white/[0.06] p-4 bg-[#0a0a0f]/80 backdrop-blur-xl">
              <form
                onSubmit={handleChat}
                className="max-w-3xl mx-auto flex gap-3"
              >
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    activeSession.documents.length === 0
                      ? "Upload a document first..."
                      : "Ask about your documents..."
                  }
                  disabled={loading}
                  className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white/90 placeholder:text-white/25 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-all disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-white/[0.06] disabled:text-white/20 text-white transition-all flex items-center gap-2 text-sm font-medium shadow-lg shadow-violet-500/10 disabled:shadow-none"
                >
                  <SendIcon />
                </button>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
