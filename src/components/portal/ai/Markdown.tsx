'use client';

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

interface Props {
  children: string;
}

function MarkdownImpl({ children }: Props) {
  return (
    <div className="rp-md text-[13px] leading-[1.6] text-white/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          h1: ({ children }) => <h1 className="text-base font-semibold text-white mb-2 mt-3 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-[14px] font-semibold text-white mb-2 mt-3 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-[13px] font-semibold text-white mb-1.5 mt-2.5 first:mt-0">{children}</h3>,
          h4: ({ children }) => <h4 className="text-[13px] font-semibold text-white/95 mb-1 mt-2 first:mt-0">{children}</h4>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic text-white/85">{children}</em>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#BC9C45] underline decoration-[#BC9C45]/40 hover:decoration-[#BC9C45] underline-offset-2"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="list-disc ps-5 mb-2 last:mb-0 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal ps-5 mb-2 last:mb-0 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="marker:text-[#BC9C45]/70">{children}</li>,
          code: ({ className, children }) => {
            const isBlock = /language-/.test(className ?? '');
            if (isBlock) {
              return (
                <code className={`${className} block whitespace-pre overflow-x-auto`}>
                  {children}
                </code>
              );
            }
            return (
              <code className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.06] text-[#E8C77A] font-mono text-[12px]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-black/40 border border-white/[0.06] rounded-lg p-3 my-2 overflow-x-auto text-[12px] leading-[1.55] font-mono text-white/85">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-s-2 border-[#BC9C45]/50 ps-3 my-2 text-white/75 italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-white/[0.08]" />,
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-lg border border-white/[0.08]">
              <table className="w-full text-[12px] border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-white/[0.04]">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-white/[0.06] last:border-0">{children}</tr>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-start font-semibold text-white/90">{children}</th>
          ),
          td: ({ children }) => <td className="px-3 py-2 text-white/85 align-top">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

const Markdown = memo(MarkdownImpl);
export default Markdown;
