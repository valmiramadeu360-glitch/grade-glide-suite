import { Fragment } from "react";
import { parseArticle } from "@/lib/news";

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-bold text-foreground">{p.slice(2, -2)}</strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export function ArticleBody({ content }: { content: string }) {
  return (
    <div className="space-y-5 text-[15px] leading-[1.8] text-foreground/90">
      {parseArticle(content).map((b, i) => {
        if (b.type === "h") return <h2 key={i} className="text-xl font-black tracking-tight text-foreground pt-2">{b.text}</h2>;
        if (b.type === "quote")
          return (
            <blockquote key={i} className="border-l-4 border-primary pl-4 py-1 text-lg font-semibold italic text-foreground">
              <Inline text={b.text} />
            </blockquote>
          );
        if (b.type === "img") return <img key={i} src={b.url} alt="" loading="lazy" className="w-full rounded-2xl" />;
        if (b.type === "list")
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {b.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}
            </ul>
          );
        return <p key={i} className="whitespace-pre-wrap"><Inline text={b.text} /></p>;
      })}
    </div>
  );
}
