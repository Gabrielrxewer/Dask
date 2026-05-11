import { useMemo } from "react";

interface EmailTemplatePreviewProps {
  subject: string;
  bodyMarkdown?: string | null;
  bodyHtml?: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  let listOpen = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (listOpen) {
        output.push("</ul>");
        listOpen = false;
      }
      continue;
    }

    if (trimmed.startsWith("## ")) {
      if (listOpen) {
        output.push("</ul>");
        listOpen = false;
      }
      output.push(`<h2>${escapeHtml(trimmed.slice(3))}</h2>`);
      continue;
    }

    if (trimmed.startsWith("# ")) {
      if (listOpen) {
        output.push("</ul>");
        listOpen = false;
      }
      output.push(`<h1>${escapeHtml(trimmed.slice(2))}</h1>`);
      continue;
    }

    if (trimmed.startsWith("- ")) {
      if (!listOpen) {
        output.push("<ul>");
        listOpen = true;
      }
      output.push(`<li>${escapeHtml(trimmed.slice(2))}</li>`);
      continue;
    }

    if (listOpen) {
      output.push("</ul>");
      listOpen = false;
    }
    output.push(`<p>${escapeHtml(trimmed)}</p>`);
  }

  if (listOpen) {
    output.push("</ul>");
  }

  return output.join("\n");
}

function buildPreviewDocument(input: EmailTemplatePreviewProps): string {
  const body = input.bodyHtml?.trim() ? input.bodyHtml : markdownToHtml(input.bodyMarkdown ?? "");
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; padding: 24px; background: #f6f7fb; color: #172033; font-family: Inter, Arial, sans-serif; line-height: 1.55; }
      main { max-width: 680px; margin: 0 auto; background: #fff; border: 1px solid #dfe4ee; border-radius: 8px; padding: 28px; }
      h1, h2 { line-height: 1.2; margin: 0 0 16px; }
      p { margin: 0 0 14px; }
      ul { margin: 0 0 16px; padding-left: 22px; }
      a { color: #1463ff; }
    </style>
  </head>
  <body>
    <main>${body}</main>
  </body>
</html>`;
}

export function EmailTemplatePreview({ subject, bodyMarkdown, bodyHtml }: EmailTemplatePreviewProps) {
  const srcDoc = useMemo(() => buildPreviewDocument({ subject, bodyMarkdown, bodyHtml }), [bodyHtml, bodyMarkdown, subject]);

  return (
    <div className="mkt-email-preview">
      <div className="mkt-email-preview__subject">
        <span>Assunto</span>
        <strong>{subject || "Sem assunto"}</strong>
      </div>
      <iframe
        title="Preview HTML do template"
        className="mkt-email-preview__frame"
        sandbox=""
        srcDoc={srcDoc}
      />
    </div>
  );
}
