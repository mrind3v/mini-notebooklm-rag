import { NextRequest, NextResponse } from "next/server";
import { PineconeStore } from "@langchain/pinecone";
import { embeddings } from "@/lib/langchain";
import { pineconeIndex } from "@/lib/pinecone";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "No query provided" }, { status: 400 });
    }

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: pineconeIndex,
    });

    const retriever = vectorStore.asRetriever({
      k: 3,
    });

    const searchedChunks = await retriever.invoke(query);

    const client = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",      defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000", // Optional, for OpenRouter rankings
        "X-Title": "Mini-NotebookLM", // Optional
      }
    });

    const system_prompt = `You are an AI Assistant who helps resolving the user query based on the avaliable context provided to you from PDF file with the content and page number.

       Rule :
       - Only answer based on the avaliable context from the file only.

       context : ${JSON.stringify(searchedChunks)}`;

    const response = await client.chat.completions.create({
      model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", // Using gpt-4o-mini as it's the current recommended mini model
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

    return NextResponse.json({ response: response.choices[0].message.content });
  } catch (error) {
    console.error("Chat error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
