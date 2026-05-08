import { Pinecone } from "@pinecone-database/pinecone";

if (!process.env.PINECONE_API_KEY) {
  throw new Error("Missing PINECONE_API_KEY");
}

export const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

export const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME!);

/**
 * Get a namespaced Pinecone index for session isolation.
 * Each chat session stores/retrieves its own vectors in a separate namespace.
 */
export function getNamespacedIndex(sessionId: string) {
  return pineconeIndex.namespace(sessionId);
}

/**
 * Delete all vectors in a session's namespace (used when deleting a chat session).
 */
export async function deleteSessionNamespace(sessionId: string) {
  await pineconeIndex.namespace(sessionId).deleteAll();
}
