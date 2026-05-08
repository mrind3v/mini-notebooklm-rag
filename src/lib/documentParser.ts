/**
 * Client-side document parser.
 * Extracts text from PDF, DOCX, CSV, and TXT files in the browser
 * so we only send text to the server (bypasses Vercel body size limits).
 */

/**
 * Extract text from a PDF file using pdfjs-dist (runs entirely in the browser).
 * The import is fully dynamic to avoid SSR issues with DOMMatrix.
 */
async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  // Set the worker source for PDF.js
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(`--- Page ${i} ---\n${pageText}`);
  }

  return pages.join("\n\n");
}

/**
 * Extract text from a plain text file.
 */
async function extractTxtText(file: File): Promise<string> {
  return await file.text();
}

/**
 * Extract text from a CSV file.
 */
async function extractCsvText(file: File): Promise<string> {
  const text = await file.text();
  return text;
}

/**
 * Extract text from a DOCX file using mammoth.
 */
async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export type SupportedFileType = "pdf" | "txt" | "csv" | "docx" | "unsupported";

export function getFileType(file: File): SupportedFileType {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const typeMap: Record<string, SupportedFileType> = {
    pdf: "pdf",
    txt: "txt",
    csv: "csv",
    docx: "docx",
  };
  // Also check MIME types
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "text/plain") return "txt";
  if (file.type === "text/csv") return "csv";
  if (
    file.type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "docx";

  return ext ? typeMap[ext] || "unsupported" : "unsupported";
}

/**
 * Parse a file and return its text content.
 * Runs entirely in the browser — no server upload of raw files needed.
 */
export async function parseDocument(file: File): Promise<string> {
  const fileType = getFileType(file);

  switch (fileType) {
    case "pdf":
      return extractPdfText(file);
    case "txt":
      return extractTxtText(file);
    case "csv":
      return extractCsvText(file);
    case "docx":
      return extractDocxText(file);
    default:
      throw new Error(
        `Unsupported file type: ${file.name}. Supported: PDF, DOCX, CSV, TXT`
      );
  }
}
