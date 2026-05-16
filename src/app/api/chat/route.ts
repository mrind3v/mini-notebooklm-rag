import { NextRequest, NextResponse } from "next/server";
import { PineconeStore } from "@langchain/pinecone";
import { embeddings } from "@/lib/langchain";
import { pineconeIndex } from "@/lib/pinecone";
import OpenAI from "openai";
import { expandQuery } from "@/lib/queryExpander";
import { rerankChunks, type RerankResult } from "@/lib/reranker";
import { evaluateRetrieval } from "@/lib/retrievalEvaluator";
import { reformulateQuery } from "@/lib/queryReformulator";

export const maxDuration = 60;

/**
 * Retrieve and rerank chunks for a given query string.
 */
async function retrieveAndRerank(
  queryStr: string,
  sessionId: string,
  topK: number = 15
): Promise<RerankResult> {
  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: pineconeIndex,
    namespace: sessionId,
  });

  const retriever = vectorStore.asRetriever({ k: topK });
  const searchedChunks = await retriever.invoke(queryStr);
  return rerankChunks(queryStr, searchedChunks, 5, 0.01);
}

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

    // ── Corrective RAG Pipeline ───────────────────────────────────────────
    // Step 1: Expand the user query
    const expandedQuery = await expandQuery(query);

    // Step 2: Initial retrieval + reranking with threshold filter
    let finalResult = await retrieveAndRerank(expandedQuery, sessionId);
    let usedReformulation = false;

    // Step 3: Corrective action — if retrieval is weak, reformulate and retry
    // Weak retrieval = no chunks passed threshold OR top score is below 0.2
    if (finalResult.chunks.length === 0 || finalResult.maxScore < 0.2) {
      console.log(
        `[CRAG] Initial retrieval weak (maxScore: ${finalResult.maxScore.toFixed(3)}, chunks: ${finalResult.chunks.length}). Reformulating...`
      );
      const reformulated = await reformulateQuery(query);
      const expandedReformulated = await expandQuery(reformulated);
      const retryResult = await retrieveAndRerank(expandedReformulated, sessionId);

      console.log(
        `[CRAG] Retry result: maxScore=${retryResult.maxScore.toFixed(3)}, chunks=${retryResult.chunks.length}`
      );

      // Use whichever attempt gave the better max score
      if (retryResult.maxScore >= finalResult.maxScore) {
        finalResult = retryResult;
        usedReformulation = true;
      }
    }

    // Step 4: Evaluate retrieval quality with an LLM
    let evaluation = { sufficient: true, rawResponse: "SKIPPED" };
    if (finalResult.chunks.length > 0) {
      evaluation = await evaluateRetrieval(query, finalResult.chunks);
      console.log(`[CRAG] LLM evaluation: ${evaluation.sufficient} (${evaluation.rawResponse})`);
    }

    // Step 5: If nothing useful after corrective attempts, tell the user
    if (!evaluation.sufficient && finalResult.chunks.length === 0) {
      return NextResponse.json({
        response:
          "I couldn't find relevant information in your uploaded documents. Try rephrasing your question or uploading a different document.",
      });
    }

    // ── Generation ─────────────────────────────────────────────────────────
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
    const contextParts = finalResult.chunks.map((chunk, i) => {
      const source = chunk.metadata?.source || "unknown";
      return `[Chunk ${i + 1} from "${source}"]:\n${chunk.pageContent}`;
    });

    // Build conversation history for context
    const historyContext =
      history && history.length > 0
        ? history
            .map((msg: { role: string; content: string }) =>
              `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
            )
            .join("\n")
        : "";

    // Flag if we had low-confidence retrieval so the LLM knows to be careful
    const lowConfidenceFlag =
      !evaluation.sufficient || finalResult.maxScore < 0.2
        ? `\n⚠️ The retrieved context may be incomplete or only partially relevant to the user's question. Use what you can from the snippets, but do not hallucinate information. If the context truly does not contain the answer, say so clearly.`
        : "";

    const system_prompt = `You are an intelligent AI research assistant for the "Mini-NotebookLM" application. Your job is to help users understand and analyze the documents they have uploaded.

## Context Information:
Below are snippets (chunks) retrieved from the uploaded documents. Each snippet is labeled with its source and chunk number.

${contextParts.join("\n\n")}${lowConfidenceFlag}

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

    const stream = await client.chat.completions.create({
      model: "openai/gpt-5-nano",
      messages,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
        controller.close();
      },
    });

    return new NextResponse(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
