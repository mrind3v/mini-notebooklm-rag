import { NextRequest, NextResponse } from "next/server";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf"
import { TextLoader } from "@langchain/classic/document_loaders/fs/text"
import { PineconeStore } from "@langchain/pinecone";
import { embeddings } from "@/lib/langchain";
import { pineconeIndex } from "@/lib/pinecone";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log("File received:", file.name, file.type);

    let loader;
    if (file.type === "application/pdf") {
      loader = new PDFLoader(file);
    } else if (file.type === "text/plain") {
      loader = new TextLoader(file);
    } else {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    console.log("Loading documents...");
    const rawDocs = await loader.load();
    console.log(`Loaded ${rawDocs.length} raw document chunks.`);

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    console.log("Splitting documents...");
    const docs = await textSplitter.splitDocuments(rawDocs);
    console.log(`Split into ${docs.length} final chunks.`);

    // Indexing Completed
    console.log("Starting Pinecone indexing...");
    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: pineconeIndex,
      maxConcurrency: 5,
    });
    console.log("Pinecone indexing completed.");

    return NextResponse.json({ message: "Indexing Completed" });
  } catch (error) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
