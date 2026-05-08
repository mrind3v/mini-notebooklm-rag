import { NextRequest, NextResponse } from "next/server";
import { PineconeStore } from "@langchain/pinecone";
import { embeddings } from "@/lib/langchain";
import { pineconeIndex } from "@/lib/pinecone";
import OpenAI from "openai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { query, sessionId } = await req.json();

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

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: pineconeIndex,
      namespace: sessionId,
    });

    const retriever = vectorStore.asRetriever({
      k: 5,
    });

    const searchedChunks = await retriever.invoke(query);

    // If no relevant chunks found, let the user know
    if (searchedChunks.length === 0) {
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

    // Build context from retrieved chunks with source info
    const contextParts = searchedChunks.map((chunk, i) => {
      const source = chunk.metadata?.source || "unknown";
      return `[Chunk ${i + 1} from "${source}"]:\n${chunk.pageContent}`;
    });

    const system_prompt = `You are an intelligent AI research assistant for the "Mini-NotebookLM" application. Your job is to help users understand and analyze the documents they have uploaded.

## Rules:
1. **ONLY** answer based on the provided context from the uploaded documents.
2. If the answer is not in the context, say "I couldn't find information about that in the uploaded documents."
3. When referencing information, mention the source document name when possible.
4. Use clear formatting: headings, bullet points, bold text, and code blocks where appropriate.
5. Provide thorough, well-structured answers.

## Retrieved Context:
${contextParts.join("\n\n")}`;

    const response = await client.chat.completions.create({
      model: "openai/gpt-5-nano",
      messages: [
        {
          role: "system",
          content: system_prompt,
        },
        {
          role: "user",
          content: query,
        },
      ],
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
