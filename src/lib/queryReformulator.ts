import OpenAI from "openai";

const REFORMULATION_PROMPT = `The user asked: "{query}"

Initial retrieval did not find relevant chunks in the uploaded documents.

Your task: Rephrase the query to better match the language, keywords, and phrasing that might exist inside uploaded documents (PDFs, DOCX, CSV, TXT). Avoid adding new concepts that weren't in the user's original query.

Return ONLY the rephrased query, nothing else.`;

/**
 * Reformulate a query when the first retrieval attempt scores poorly.
 */
export async function reformulateQuery(query: string): Promise<string> {
  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Mini-NotebookLM",
    },
  });

  try {
    const response = await client.chat.completions.create({
      model: "minimax/minimax-m2.5",
      messages: [
        {
          role: "system",
          content:
            "You reformulate user queries for a document retrieval system. Keep the core meaning intact.",
        },
        {
          role: "user",
          content: REFORMULATION_PROMPT.replace("{query}", query),
        },
      ],
      temperature: 0.3,
      max_tokens: 120,
    });

    const rephrased = response.choices[0].message.content?.trim() || query;
    return rephrased;
  } catch (error) {
    console.error("Query reformulation failed:", error);
    return query; // fall back to original
  }
}
