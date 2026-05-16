# Mini-NotebookLM

A lightweight, browser-first NotebookLM alternative built with Next.js, LangChain, and Pinecone.

## Project Overview

Mini-NotebookLM allows users to upload documents (PDF, DOCX, CSV, TXT) into isolated chat sessions and perform Retrieval-Augmented Generation (RAG) to query their contents. The project prioritizes client-side processing to minimize server load and bypass Vercel's body size limits.

### Core Technologies
- **Framework:** Next.js 15+ (App Router), React 19
- **Styling:** Tailwind CSS v4
- **Vector Database:** Pinecone (using namespaces for session isolation)
- **Orchestration:** LangChain (@langchain/pinecone, @langchain/openai)
- **AI Models:** 
  - Query Expansion: `minimax/minimax-m2.5` via OpenRouter
  - Chat Completion: `openai/gpt-5-nano` via OpenRouter (streams to client)
  - Embeddings: `text-embedding-3-small` (via LangChain)
- **Document Parsing:** Browser-based extraction using `pdfjs-dist` and `mammoth`.

## Architecture & RAG Pipeline

### 1. Document Ingestion
- **Client-Side Parsing:** Documents are parsed in the browser (`src/lib/documentParser.ts`). Only the extracted text is sent to the `/api/upload` endpoint.
- **Chunking:** Text is split using `RecursiveCharacterTextSplitter` with a chunk size of 1000 and an overlap of 100.
- **Indexing:** Chunks are embedded and stored in Pinecone using the `sessionId` as the namespace.

### 2. Chat & Retrieval (`/api/chat`)
- **Query Expansion:** The user's query is expanded using an LLM to improve retrieval recall.
- **Retrieval:** Top 15 relevant chunks are retrieved from the Pinecone namespace.
- **Reranking:** The 15 chunks are reranked using cosine similarity against the original query embedding, selecting the top 5 for context.
- **Streaming:** The LLM generates a response based on the context and conversation history, which is streamed to the UI.

### 3. Session Management
- **Persistence:** Chat sessions and message history are stored in `localStorage`.
- **Cleanup:** Deleting a session triggers a background request to delete the corresponding Pinecone namespace.

## Key Files & Directories

- `src/app/page.tsx`: Main UI, handling session state and chat interactions.
- `src/app/api/upload/route.ts`: Endpoint for chunking and indexing text into Pinecone.
- `src/app/api/chat/route.ts`: Core RAG logic: expansion, retrieval, reranking, and streaming.
- `src/lib/documentParser.ts`: Logic for extracting text from various file formats in the browser.
- `src/lib/pinecone.ts`: Pinecone client initialization.
- `src/lib/langchain.ts`: Embeddings configuration.
- `public/pdf.worker.min.mjs`: Worker for `pdfjs-dist`, required for client-side PDF parsing.

## Building and Running

### Development
```bash
npm run dev
```
Starts the development server at `http://localhost:3000`.

### Production
```bash
npm run build
npm run start
```

### Linting
```bash
npm run lint
```

## Environment Variables

The project requires the following environment variables (see `.env.example`):

- `OPENROUTER_API_KEY`: Primary API key for LLM services.
- `OPENAI_API_KEY`: Fallback API key.
- `PINECONE_API_KEY`: Required for vector storage operations.
- `PINECONE_INDEX_NAME`: The name of the Pinecone index to use.
- `NEXT_PUBLIC_APP_URL`: (Optional) Base URL for the application.

## Development Conventions

- **Client Components:** Use `"use client"` for components requiring state or browser APIs.
- **Icons:** Inline SVG icons are preferred over external libraries for minimal footprint.
- **Dependencies:** Use `npm install --legacy-peer-deps` to avoid peer dependency conflicts with some LangChain/React 19 packages.
- **External Packages:** `pdf-parse` and `pdfjs-dist` are marked as `serverExternalPackages` in `next.config.ts`.
- **Path Aliases:** Use `@/*` for imports from the `src/` directory.
