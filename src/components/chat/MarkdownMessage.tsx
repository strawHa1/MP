import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { openExternalUrl } from '../../lib/externalLink';

interface MarkdownMessageProps {
  content: string;
}

/**
 * Renders assistant replies as Markdown (bold, lists, tables, code) since the
 * model is instructed to return structured risk data. GFM is enabled for tables.
 */
export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content }) => (
  <div className="text-xs leading-relaxed break-words">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => (
          <strong className="font-bold text-slate-900 dark:text-white">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="marker:text-purple-500">{children}</li>,
        h1: ({ children }) => (
          <h1 className="text-sm font-extrabold mb-2 text-slate-900 dark:text-white">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xs font-extrabold mb-1.5 mt-2 text-slate-900 dark:text-white uppercase tracking-wide">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-xs font-bold mb-1 mt-2 text-slate-800 dark:text-slate-100">{children}</h3>
        ),
        a: ({ href, children }) => (
          <button
            type="button"
            onClick={() => href && openExternalUrl(href)}
            className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-500"
          >
            {children}
          </button>
        ),
        code: ({ className, children }) => {
          const isBlock = (className || '').includes('language-');
          if (isBlock) {
            return (
              <code className="block font-mono text-[11px] whitespace-pre-wrap">{children}</code>
            );
          }
          return (
            <code className="font-mono text-[11px] px-1 py-0.5 rounded bg-slate-200/70 dark:bg-[#0A0E17] text-purple-700 dark:text-purple-300">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="mb-2 p-3 rounded-xl bg-slate-100 dark:bg-[#0A0E17] border border-slate-200 dark:border-[#232A3D] overflow-x-auto custom-scrollbar">
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-purple-500/60 pl-3 my-2 text-slate-600 dark:text-slate-400 italic">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-2 border-slate-200 dark:border-[#232A3D]" />,
        // Tables can be wider than the bubble on mobile, so they scroll horizontally.
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto custom-scrollbar rounded-xl border border-slate-200 dark:border-[#232A3D]">
            <table className="w-full text-[11px] border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-slate-100 dark:bg-[#0A0E17]">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="text-left font-bold px-2.5 py-1.5 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-[#232A3D] whitespace-nowrap">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-2.5 py-1.5 border-b border-slate-100 dark:border-[#1B2233] align-top">
            {children}
          </td>
        )
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);
