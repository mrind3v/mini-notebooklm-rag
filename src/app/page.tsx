"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [query, setQuery] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setMessage("Indexing...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessage("Indexing Completed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setMessage(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    const newHistory = [...chatHistory, { role: "user", content: query }];
    setChatHistory(newHistory);
    setQuery("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setChatHistory([...newHistory, { role: "assistant", content: data.response }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setChatHistory([...newHistory, { role: "assistant", content: `Error: ${message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50">
      <div className="z-10 w-full max-w-3xl items-center justify-between font-mono text-sm flex flex-col gap-8">
        <h1 className="text-4xl font-bold text-blue-600">Mini-NotebookLM</h1>
        
        {/* Upload Section */}
        <div className="w-full bg-white p-6 rounded-xl shadow-md flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Upload Document (PDF/TXT)</h2>
          <div className="flex gap-4 items-center">
            <input 
              type="file" 
              accept=".pdf,.txt" 
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <button 
              onClick={handleUpload}
              disabled={loading || !file}
              className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold disabled:bg-gray-400 hover:bg-blue-700 transition-colors"
            >
              Upload
            </button>
          </div>
          {message && <p className="text-sm text-gray-600 italic">{message}</p>}
        </div>

        {/* Chat Section */}
        <div className="w-full bg-white p-6 rounded-xl shadow-md flex flex-col gap-4 min-h-[400px]">
          <h2 className="text-xl font-semibold">Chat</h2>
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto max-h-[500px] border-b pb-4">
            {chatHistory.length === 0 && (
              <p className="text-gray-400 text-center mt-20">Upload a document to start chatting!</p>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && chatHistory[chatHistory.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 p-3 rounded-lg italic">Thinking...</div>
              </div>
            )}
          </div>
          <form onSubmit={handleChat} className="flex gap-4">
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask something about the document..."
              className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              type="submit"
              disabled={loading || !query}
              className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold disabled:bg-gray-400 hover:bg-blue-700 transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
