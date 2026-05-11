# Agent Instructions

## Project

Next.js App Router app (v16.2.5) providing a lightweight NotebookLM alternative via RAG. Users upload documents (PDF/DOCX/CSV/TXT) into chat sessions, ask questions, and the backend retrieves relevant chunks from Pinecone before streaming an LLM response.

## Commands

- `npm run dev` — start dev server on http://localhost:3000
- `npm run build` — production build
- `npm run lint` — ESLint (no test runner is configured)

**Install dependency changes with:**

```bash
npm install --legacy-peer-deps
```

`.npmrc` sets `legacy-peer-deps=true`; omitting the flag may cause peer-dep failures.

## Environment Variables

Required (see `.env.example`):

- `OPENROUTER_API_KEY` — primary key for embeddings and chat completions via OpenRouter
- `OPENAI_API_KEY` — fallback if OpenRouter key is absent
- `PINECONE_API_KEY` — required at runtime (boot-time error if missing)
- `PINECONE_INDEX_NAME` — target Pinecone index
- `NEXT_PUBLIC_APP_URL` — optional, used as Referer header fallback (`http://localhost:3000`)

## Architecture

- **UI entrypoint:** `src/app/page.tsx` (client component)
- **API routes:**
  - `POST /api/upload` — receives `{ text, fileName, sessionId }`, chunks text with `RecursiveCharacterTextSplitter` (1000/100 overlap), and indexes into Pinecone under namespace = `sessionId`
  - `POST /api/chat` — expands query, retrieves top-15 chunks from the session namespace, reranks to top-5 via cosine similarity, then streams LLM response as `text/plain`
  - `DELETE /api/session` — deletes all vectors in the given `sessionId` namespace
- **Client-side state:** Sessions and messages live in `localStorage`; only document vectors live in Pinecone. Deleting a chat session removes the vectors from Pinecone but leaves localStorage entries unless the client cleans them.

## Key Conventions & Quirks

- **Document parsing happens in the browser, not the server.** `src/lib/documentParser.ts` uses dynamic imports (`pdfjs-dist`, `mammoth`) to extract text client-side so the upload API receives only a JSON payload of text. This bypasses Vercel body-size limits. Do not change `/api/upload` to accept raw multipart file uploads without considering this.
- `pdfjs-dist` worker is served from `/pdf.worker.min.mjs` in the `public/` directory. If PDF parsing breaks, verify this file is present and the worker path in `documentParser.ts` matches.
- `next.config.ts` declares `serverExternalPackages: ["pdf-parse", "pdfjs-dist"]`.
- **RAG pipeline:**
  1. Query expansion via OpenRouter (`minimax/minimax-m2.5`)
  2. Pinecone retrieval (top-15)
  3. Reranking with cosine similarity over embeddings (top-5)
  4. Streaming completion (`openai/gpt-5-nano`)
- The reranker re-embeds every retrieved chunk synchronously; be mindful of latency/cost when tuning `k`.
- API routes set `maxDuration = 60` for Vercel Hobby plan compatibility.
- Path alias `@/*` maps to `./src/*`.

## Code Style

- TypeScript strict mode enabled.
- Tailwind CSS v4 with `@tailwindcss/postcss` (no `tailwind.config.js`).
- ESLint extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.
- Client components use `"use client"`.
- SVG icons are kept inline in `page.tsx`; the only shared component is `MarkdownMessage`.
