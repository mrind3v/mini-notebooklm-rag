import OpenAI from "openai";

const EXPANSION_PROMPT = `Given the user's question about uploaded documents, 
expand it with relevant keywords and context that would help find the most relevant information.
Return ONLY the expanded query, nothing else.

User question: {query}

Expanded query:`;

export async function expandQuery(query: string): Promise<string> {
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
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a query expansion assistant for a RAG system.",
        },
        {
          role: "user",
          content: EXPANSION_PROMPT.replace("{query}", query),
        },
      ],
      temperature: 0.3,
    });

    return response.choices[0].message.content?.trim() || query;
  } catch (error) {
    console.error("Query expansion failed:", error);
    return query;
  }
}