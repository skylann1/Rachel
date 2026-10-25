import React from 'react';
import { parseNewsContent, type InlineToken } from '@/lib/news';

function Inline({ tokens }: { tokens: InlineToken[] }) {
  return (
    <>
      {tokens.map((tk, i) =>
        tk.t === 'bold' ? <strong key={i} className="font-bold text-slate-800">{tk.v}</strong>
        : tk.t === 'link' ? <a key={i} href={tk.href} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold underline underline-offset-2 hover:text-primary/80">{tk.v}</a>
        : <React.Fragment key={i}>{tk.v}</React.Fragment>,
      )}
    </>
  );
}

/** Render konten pengumuman sebagai elemen React (tanpa HTML mentah). */
export function NewsContent({ content }: { content: string | null | undefined }) {
  const blocks = parseNewsContent(content);
  if (blocks.length === 0) return null;
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'h2': return <h2 key={i} className="text-xl font-bold text-slate-900 pt-2"><Inline tokens={b.inline} /></h2>;
          case 'h3': return <h3 key={i} className="text-base font-bold text-slate-800 pt-1"><Inline tokens={b.inline} /></h3>;
          case 'quote': return <blockquote key={i} className="border-l-4 border-primary/40 bg-primary/5 rounded-r-xl px-4 py-3 text-slate-700"><Inline tokens={b.inline} /></blockquote>;
          case 'ul': return <ul key={i} className="list-disc pl-6 space-y-1.5">{b.items.map((it, j) => <li key={j}><Inline tokens={it} /></li>)}</ul>;
          case 'ol': return <ol key={i} className="list-decimal pl-6 space-y-1.5">{b.items.map((it, j) => <li key={j}><Inline tokens={it} /></li>)}</ol>;
          default: return <p key={i}><Inline tokens={b.inline} /></p>;
        }
      })}
    </div>
  );
}
