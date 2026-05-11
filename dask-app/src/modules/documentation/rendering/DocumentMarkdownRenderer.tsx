import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const allowedMarkdownProtocols = new Set(["http:", "https:", "mailto:", "tel:"]);
const allowedDataImageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
]);

function isSafeDataImageUrl(url: string): boolean {
  const match = /^data:([^;,]+);base64,[a-z0-9+/=\s]+$/i.exec(url);
  return match ? allowedDataImageTypes.has(match[1].toLowerCase()) : false;
}

export function markdownUrlTransform(url: string): string {
  const trimmedUrl = url.trim();
  const normalizedUrl = trimmedUrl.toLowerCase();

  if (trimmedUrl.length === 0) {
    return "";
  }

  if (
    trimmedUrl.startsWith("#") ||
    normalizedUrl.startsWith("blob:") ||
    trimmedUrl.startsWith("/") ||
    trimmedUrl.startsWith("./") ||
    trimmedUrl.startsWith("../")
  ) {
    return trimmedUrl;
  }

  if (normalizedUrl.startsWith("data:")) {
    return isSafeDataImageUrl(trimmedUrl) ? trimmedUrl : "";
  }

  try {
    const protocol = new URL(trimmedUrl).protocol;
    return allowedMarkdownProtocols.has(protocol) ? trimmedUrl : "";
  } catch {
    return "";
  }
}

interface DocumentMarkdownRendererProps {
  markdown: string;
  className?: string;
}

export function DocumentMarkdownRenderer({ markdown, className }: DocumentMarkdownRendererProps) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={markdownUrlTransform}>
        {markdown.trim().length > 0 ? markdown : "_Sem conteudo ainda._"}
      </ReactMarkdown>
    </div>
  );
}
