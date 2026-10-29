// A tiny, safe renderer for the short markdown used in guide fields:
// paragraphs, "- " lists, numbered lists, **bold**, `code` and [links](url).
// It builds React elements, never raw HTML, because generated guides
// contain model output.

import { Fragment, type ReactNode } from "react";

function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<code key={`${key}-${i++}`}>{m[1].slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={`${key}-${i++}`}>{m[2].slice(2, -2)}</strong>);
    else
      out.push(
        <a key={`${key}-${i++}`} href={m[4]} target="_blank" rel="noreferrer" className="text-accent underline">
          {m[3]}
        </a>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Md({ text, className = "" }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  const lines = (text ?? "").split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={`${list.ordered ? "list-decimal" : "list-disc"} pl-5 space-y-1`}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it, i)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    const bullet = /^[-*]\s+(.*)/.exec(line);
    const num = /^\d+[.)]\s+(.*)/.exec(line);
    if (bullet || num) {
      const ordered = Boolean(num);
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? num)![1]);
    } else if (line) {
      flush();
      blocks.push(<p key={blocks.length}>{inline(line, blocks.length)}</p>);
    } else flush();
  }
  flush();
  return <div className={`space-y-2 ${className}`}>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
