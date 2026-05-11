import { Document } from "@langchain/core/documents";
import { embeddings } from "./langchain";

export async function rerankChunks(
  query: string,
  chunks: Document[],
  topK: number = 5
): Promise<Document[]> {
  const queryEmbedding = await embeddings.embedQuery(query);

  const chunkEmbeddings = await Promise.all(
    chunks.map((chunk) => embeddings.embedQuery(chunk.pageContent))
  );

  const scoredChunks = chunks.map((chunk, i) => {
    const similarity = cosineSimilarity(queryEmbedding, chunkEmbeddings[i]);
    return { chunk, score: similarity };
  });

  scoredChunks.sort((a, b) => b.score - a.score);

  return scoredChunks.slice(0, topK).map((s) => s.chunk);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}