import { Document } from "@langchain/core/documents";
import { embeddings } from "./langchain";

export interface ScoredChunk {
  chunk: Document;
  score: number;
}

export interface RerankResult {
  chunks: Document[];
  scores: number[];
  maxScore: number;
  avgScore: number;
}

/**
 * Rerank retrieved chunks by cosine similarity of their embeddings vs
 * the query embedding, then filter out those below the relevance threshold.
 */
export async function rerankChunks(
  query: string,
  chunks: Document[],
  topK: number = 5,
  threshold: number = 0.01
): Promise<RerankResult> {
  if (chunks.length === 0) {
    return { chunks: [], scores: [], maxScore: 0, avgScore: 0 };
  }

  const queryEmbedding = await embeddings.embedQuery(query);

  const chunkEmbeddings = await Promise.all(
    chunks.map((chunk) => embeddings.embedQuery(chunk.pageContent))
  );

  const scoredChunks = chunks.map((chunk, i) => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunkEmbeddings[i]),
  }));

  scoredChunks.sort((a, b) => b.score - a.score);

  // Keep only chunks that pass the relevance threshold
  const filtered = scoredChunks.slice(0, topK).filter((s) => s.score >= threshold);

  const finalScores = filtered.map((s) => s.score);
  const maxScore = scoredChunks.length > 0 ? scoredChunks[0].score : 0;
  const avgScore =
    finalScores.length > 0
      ? finalScores.reduce((a, b) => a + b, 0) / finalScores.length
      : 0;

  return {
    chunks: filtered.map((s) => s.chunk),
    scores: finalScores,
    maxScore,
    avgScore,
  };
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}
