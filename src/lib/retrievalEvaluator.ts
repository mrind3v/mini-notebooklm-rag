import OpenAI from "openai";
import { Document } from "@langchain/core/documents";

const EVALUATION_PROMPT = `You are a strict retrieval evaluator for a RAG system.

User Query: {query}

Retrieved Chunks:
{chunks}

Task: Determine whether the retrieved chunks collectively contain enough relevant and specific information to answer the user's query.

Rules:
- "SUFFICIENT" means at least one chunk contains clear, specific information that directly helps answer the query.
- "INSUFFICIENT" means the chunks are off-topic, too generic, or do not contain the needed facts.

Respond with ONLY one word: either "SUFFICIENT" or "INSUFFICIENT".`;

export interface RetrievalEvaluation {
  sufficient: boolean;
  rawResponse: string;
}

export async function evaluateRetrieval(
  query: string,
  chunks: Document[]
): Promise<RetrievalEvaluation> {
  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Mini-NotebookLM",
    },
  });

  const chunksText = chunks
    .map((c, i) => `[${i + 1}] Source: "${c.metadata?.source ?? "unknown"}"\n${c.pageContent}`)
    .join("\n\n---\n\n");

  const prompt = EVALUATION_PROMPT.replace("{query}", query).replace(
    "{chunks}",
    chunksText || "NO CHUNKS RETRIEVED"
  );

  try {
    const response = await client.chat.completions.create({
      model: "minimax/minimax-m2.5",
      messages: [
        {
          role: "system",
          content:
            "You assess retrieved document chunks for a RAG system. Be strict and objective.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 10,
    });

    const raw = (response.choices[0].message.content ?? "").trim().toUpperCase();
    return { sufficient: raw.includes("SUFFICIENT"), rawResponse: raw };
  } catch (error) {
    console.error("Retrieval evaluation failed:", error);
    // Fail-safe: assume insufficient on error so we try reformulation
    return { sufficient: false, rawResponse: "ERROR" };
  }
}
