"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

interface MarkdownMessageProps {
  content: string;
}

export default function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Override default element rendering for better styling
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mt-4 mb-2 text-gray-900 dark:text-white/95">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold mt-3 mb-2 text-gray-700 dark:text-white/90">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-2 mb-1 text-gray-700 dark:text-white/85">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-2 leading-relaxed text-gray-700 dark:text-white/80">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-2 space-y-1 text-gray-700 dark:text-white/80">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-2 space-y-1 text-gray-700 dark:text-white/80">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="ml-2">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900 dark:text-white/95">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-600 dark:text-white/75">
              {children}
            </em>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="bg-gray-100 dark:bg-white/10 text-emerald-600 dark:text-emerald-300 px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={`${className} text-sm`} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-gray-100 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg p-4 my-3 overflow-x-auto text-sm">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-violet-400/50 pl-4 my-2 italic text-gray-600 dark:text-white/70">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-gray-100 dark:bg-white/10 px-3 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white/90 border-b border-gray-200 dark:border-white/10">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-sm text-gray-600 dark:text-white/75 border-b border-gray-100 dark:border-white/5">
              {children}
            </td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 underline underline-offset-2"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="border-gray-200 dark:border-white/10 my-4" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
