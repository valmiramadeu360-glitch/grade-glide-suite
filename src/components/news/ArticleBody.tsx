import { Fragment } from "react";
import { parseArticle } from "@/lib/news";

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-bold text-foreground">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        )
      )}
    </>
  );
}

export function ArticleBody({ content }: { content: string }) {
  return (
    <div className="space-y-5 text-[15px] leading-[1.8] text-foreground/90 font-normal">
      {parseArticle(content).map((b, i) => {
        if (b.type === "h") {
          return (
            <h2 key={i} className="text-xl sm:text-2xl font-black tracking-tight text-foreground pt-4 pb-1">
              {b.text}
            </h2>
          );
        }
        if (b.type === "quote") {
          return (
            <blockquote
              key={i}
              className="border-l-4 border-primary pl-4 py-1.5 my-3 text-base sm:text-lg font-semibold italic text-foreground/90 bg-muted/20 rounded-r-2xl"
            >
              <Inline text={b.text} />
            </blockquote>
          );
        }
        if (b.type === "img") {
          return (
            <figure key={i} className="my-4">
              <img
                src={b.url}
                alt=""
                loading="lazy"
                className="w-full rounded-2xl object-cover max-h-[500px] border border-border/40 shadow-sm"
              />
            </figure>
          );
        }
        if (b.type === "list") {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1.5 text-foreground/90 my-2">
              {b.items.map((it, j) => (
                <li key={j} className="leading-relaxed">
                  <Inline text={it} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap leading-relaxed">
            <Inline text={b.text} />
          </p>
        );
      })}
    </div>
  );
}
