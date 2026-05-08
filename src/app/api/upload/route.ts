import { NextRequest, NextResponse } from "next/server";
import { PineconeStore } from "@langchain/pinecone";
import { embeddings } from "@/lib/langchain";
import { pineconeIndex } from "@/lib/pinecone";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";

// Allow up to 60s for this route on Vercel (max for Hobby plan)
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, fileName, sessionId } = body;

    if (!text || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields: text, sessionId" },
        { status: 400 }
      );
    }

    console.log(
      `Processing document: ${fileName} for session: ${sessionId} (${text.length} chars)`
    );

    // Create a LangChain Document from the pre-extracted text
    const rawDoc = new Document({
      pageContent: text,
      metadata: {
        source: fileName || "unknown",
        sessionId: sessionId,
      },
    });

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 100,
    });

    console.log("Splitting document...");
    const docs = await textSplitter.splitDocuments([rawDoc]);
    console.log(`Split into ${docs.length} chunks.`);

    console.log("Starting Pinecone indexing...");
    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: pineconeIndex,
      namespace: sessionId,
      maxConcurrency: 5,
    });
    console.log("Pinecone indexing completed.");

    return NextResponse.json({
      message: "Indexing Completed",
      chunks: docs.length,
    });
  } catch (error) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
