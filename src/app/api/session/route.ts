import { NextRequest, NextResponse } from "next/server";
import { deleteSessionNamespace } from "@/lib/pinecone";

export async function DELETE(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "No sessionId provided" },
        { status: 400 }
      );
    }

    console.log(`Deleting session namespace: ${sessionId}`);
    await deleteSessionNamespace(sessionId);

    return NextResponse.json({ message: "Session deleted" });
  } catch (error) {
    console.error("Session delete error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
