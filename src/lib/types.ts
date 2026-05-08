export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSession {
  id: string;
  name: string;
  createdAt: number;
  messages: ChatMessage[];
  documents: string[]; // filenames uploaded to this session
}
