import { OpenAIEmbeddings } from "@langchain/openai";

export const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
  openAIApiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
});
