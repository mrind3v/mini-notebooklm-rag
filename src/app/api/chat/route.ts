import { NextRequest, NextResponse } from "next/server";
import { PineconeStore } from "@langchain/pinecone";
import { embeddings } from "@/lib/langchain";
import { pineconeIndex } from "@/lib/pinecone";
import OpenAI from "openai";
import { expandQuery } from "@/lib/queryExpander";
import { rerankChunks } from "@/lib/reranker";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { query, sessionId, history } = await req.json();

    if (!query) {
      return NextResponse.json(
        { error: "No query provided" },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: "No sessionId provided" },
        { status: 400 }
      );
    }

    const expandedQuery = await expandQuery(query);

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: pineconeIndex,
      namespace: sessionId,
    });

    const retriever = vectorStore.asRetriever({
      k: 15,
    });

    const searchedChunks = await retriever.invoke(expandedQuery);

    const rerankedChunks = await rerankChunks(expandedQuery, searchedChunks, 5);

    // If no relevant chunks found, let the user know
    if (rerankedChunks.length === 0) {
      return NextResponse.json({
        response:
          "No relevant documents found in this session. Please upload a document first.",
      });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Mini-NotebookLM",
      },
    });

    // Build context from reranked chunks with source info
    const contextParts = rerankedChunks.map((chunk, i) => {
      const source = chunk.metadata?.source || "unknown";
      return `[Chunk ${i + 1} from "${source}"]:\n${chunk.pageContent}`;
    });

    // Build conversation history for context
    const historyContext = history && history.length > 0
      ? history
          .map((msg: { role: string; content: string }) =>
            `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
          )
          .join("\n")
      : "";

    const system_prompt = `You are an intelligent AI research assistant for the "Mini-NotebookLM" application. Your job is to help users understand and analyze the documents they have uploaded.

## Context Information:
Below are snippets (chunks) retrieved from the uploaded documents. Each snippet is labeled with its source and chunk number.

${contextParts.join("\n\n")}

## Instructions:
1. **Core Rule:** Base your response **exclusively** on the provided context.
2. **Summary Requests:** If the user asks for a summary and the context seems sparse (e.g., mostly headers or small snippets), synthesize what IS there (key terms, metrics, names) while explaining that these represent the most relevant parts found for their specific query.
3. **No Information:** If the context is truly irrelevant or empty, say "I couldn't find sufficient information in the uploaded documents to answer that."
4. **Citations:** Always mention the source document name when referencing specific data.
5. **Formatting:** Use clear Markdown (headings, lists, bolding) for readability.
6. **Tone:** Professional, analytical, and helpful.`;

    type MessageRole = "system" | "user" | "assistant";

    const messages: { role: MessageRole; content: string }[] = [
      {
        role: "system",
        content: system_prompt,
      },
    ];

    if (historyContext) {
      messages.push({
        role: "user",
        content: `Previous conversation:\n${historyContext}`,
      });
    }

    messages.push({
      role: "user",
      content: query,
    });

    const response = await client.chat.completions.create({
      model: "openai/gpt-5-nano",
      messages,
    });

    return NextResponse.json({
      response: response.choices[0].message.content,
    });
  } catch (error) {
    console.error("Chat error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
