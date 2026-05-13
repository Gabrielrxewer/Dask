import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent
} from "react";

type MarkdownBlockKind =
  | "paragraph"
  | "blank"
  | "heading"
  | "unordered-list"
  | "ordered-list"
  | "checklist"
  | "quote"
  | "code-block"
  | "table"
  | "divider";

interface MarkdownBlock {
  id: string;
  kind: MarkdownBlockKind;
  text: string;
  level?: number;
  checked?: boolean;
  order?: number;
  language?: string;
}

export interface MarkdownEditorSelection {
  start: number;
  end: number;
}

export interface MarkdownEditorHandle {
  getValue: () => string;
  getSelection: () => MarkdownEditorSelection;
  getSelectedText: () => string;
  focus: () => void;
  setSelectionRange: (start: number, end: number) => void;
}

interface EditableMarkdownPreviewProps {
  value: string;
  renderedMarkdown: string;
  className?: string;
  readOnly?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
  onSelectionChange: (selectedText: string) => void;
}

let blockIdSequence = 0;

function createBlockId() {
  blockIdSequence += 1;
  return `markdown-block-${blockIdSequence}`;
}

function createBlock(input: Omit<MarkdownBlock, "id">): MarkdownBlock {
  return { id: createBlockId(), ...input };
}

function parseMarkdownLine(line: string): MarkdownBlock {
  if (line.trim().length === 0) {
    return createBlock({ kind: "blank", text: "" });
  }

  const heading = /^(#{1,6})\s+(.*)$/.exec(line);
  if (heading) {
    return createBlock({ kind: "heading", level: heading[1].length, text: heading[2] });
  }

  const checklist = /^[-*]\s+\[([ xX])\]\s?(.*)$/.exec(line);
  if (checklist) {
    return createBlock({ kind: "checklist", checked: checklist[1].toLowerCase() === "x", text: checklist[2] });
  }

  const unordered = /^[-*]\s+(.*)$/.exec(line);
  if (unordered) {
    return createBlock({ kind: "unordered-list", text: unordered[1] });
  }

  const ordered = /^(\d+)\.\s+(.*)$/.exec(line);
  if (ordered) {
    return createBlock({ kind: "ordered-list", order: Number(ordered[1]), text: ordered[2] });
  }

  const quote = /^>\s?(.*)$/.exec(line);
  if (quote) {
    return createBlock({ kind: "quote", text: quote[1] });
  }

  if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
    return createBlock({ kind: "divider", text: "" });
  }

  if (/^\|.+\|$/.test(line.trim())) {
    return createBlock({ kind: "table", text: line });
  }

  return createBlock({ kind: "paragraph", text: line });
}

export function parseMarkdownToBlocks(markdown: string): MarkdownBlock[] {
  if (markdown.length === 0) {
    return [createBlock({ kind: "paragraph", text: "" })];
  }

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const codeFence = /^```([A-Za-z0-9_-]*)\s*$/.exec(line);

    if (codeFence) {
      const codeLines: string[] = [];
      let cursor = index + 1;
      while (cursor < lines.length && !/^```\s*$/.test(lines[cursor])) {
        codeLines.push(lines[cursor]);
        cursor += 1;
      }
      blocks.push(createBlock({ kind: "code-block", text: codeLines.join("\n"), language: codeFence[1] }));
      index = cursor < lines.length ? cursor : lines.length - 1;
      continue;
    }

    blocks.push(parseMarkdownLine(line));
  }

  return blocks.length > 0 ? blocks : [createBlock({ kind: "paragraph", text: "" })];
}

function serializeMarkdownBlock(block: MarkdownBlock): string {
  switch (block.kind) {
    case "blank":
      return "";
    case "heading":
      return `${"#".repeat(block.level ?? 1)} ${block.text}`.trimEnd();
    case "unordered-list":
      return `- ${block.text}`.trimEnd();
    case "ordered-list":
      return `${block.order ?? 1}. ${block.text}`.trimEnd();
    case "checklist":
      return `- [${block.checked ? "x" : " "}] ${block.text}`.trimEnd();
    case "quote":
      return `> ${block.text}`.trimEnd();
    case "code-block":
      return `\`\`\`${block.language ?? ""}\n${block.text}\n\`\`\``;
    case "table":
      return block.text;
    case "divider":
      return "---";
    case "paragraph":
    default:
      return block.text;
  }
}

export function serializeMarkdownBlocks(blocks: MarkdownBlock[]): string {
  return blocks.map(serializeMarkdownBlock).join("\n");
}

function parseEditableText(text: string, fallback: MarkdownBlock): MarkdownBlock[] {
  const normalizedText = text.replace(/\r\n/g, "\n");
  const parsedBlocks = normalizedText.split("\n").map(parseMarkdownLine);

  if (parsedBlocks.length === 1) {
    const parsed = parsedBlocks[0];
    if (
      parsed.kind === "paragraph" &&
      fallback.kind !== "paragraph" &&
      fallback.kind !== "blank" &&
      fallback.kind !== "divider" &&
      normalizedText.trim().length > 0
    ) {
      return [{ ...fallback, text: parsed.text }];
    }

    return [{ ...parsed, id: fallback.id }];
  }

  return parsedBlocks.map((parsed, index) => (index === 0 ? { ...parsed, id: fallback.id } : parsed));
}

function getBlockPrefixLength(block: MarkdownBlock): number {
  switch (block.kind) {
    case "heading":
      return (block.level ?? 1) + 1;
    case "unordered-list":
      return 2;
    case "ordered-list":
      return `${block.order ?? 1}. `.length;
    case "checklist":
      return 6;
    case "quote":
      return 2;
    case "code-block":
      return `\`\`\`${block.language ?? ""}\n`.length;
    default:
      return 0;
  }
}

function getSelectionOffset(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !element.contains(selection.anchorNode)) {
    return 0;
  }

  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(element);
  range.setEnd(selection.anchorNode!, selection.anchorOffset);
  return range.toString().length;
}

function setElementSelection(element: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node = walker.nextNode();

  while (node) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= length;
    node = walker.nextNode();
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getBlockClassName(block: MarkdownBlock) {
  return [
    "editable-markdown__block",
    `editable-markdown__block--${block.kind}`,
    block.kind === "heading" ? `editable-markdown__block--h${block.level ?? 1}` : ""
  ].filter(Boolean).join(" ");
}

export const EditableMarkdownPreview = forwardRef<MarkdownEditorHandle, EditableMarkdownPreviewProps>(
  (
    {
      value,
      renderedMarkdown,
      className = "",
      readOnly = false,
      placeholder = "Comece a escrever seu documento...",
      onChange,
      onSelectionChange
    },
    ref
  ) => {
    const [blocks, setBlocks] = useState(() => parseMarkdownToBlocks(value));
    const lastEmittedValueRef = useRef(value);
    const activeBlockIdRef = useRef<string | null>(null);
    const blockRefs = useRef(new Map<string, HTMLElement>());

    useEffect(() => {
      if (value !== lastEmittedValueRef.current) {
        setBlocks(parseMarkdownToBlocks(value));
        lastEmittedValueRef.current = value;
      }
    }, [value]);

    const markdownValue = useMemo(() => serializeMarkdownBlocks(blocks), [blocks]);

    const getBlockOffsets = useCallback(
      (targetBlocks = blocks) => {
        let cursor = 0;
        return targetBlocks.map((block) => {
          const serialized = serializeMarkdownBlock(block);
          const start = cursor;
          const end = cursor + serialized.length;
          cursor = end + 1;
          return { id: block.id, start, end, block };
        });
      },
      [blocks]
    );

    const getSelection = useCallback((): MarkdownEditorSelection => {
      const activeBlockId = activeBlockIdRef.current;
      const activeElement = activeBlockId ? blockRefs.current.get(activeBlockId) : null;
      const activeOffset = getBlockOffsets().find((offset) => offset.id === activeBlockId);

      if (!activeElement || !activeOffset) {
        return { start: markdownValue.length, end: markdownValue.length };
      }

      const offset = getSelectionOffset(activeElement);
      const markdownOffset = Math.min(activeOffset.end, activeOffset.start + getBlockPrefixLength(activeOffset.block) + offset);
      return { start: markdownOffset, end: markdownOffset };
    }, [getBlockOffsets, markdownValue.length]);

    const getSelectedText = useCallback(() => {
      const selection = window.getSelection();
      return selection?.toString() ?? "";
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        getValue: () => markdownValue,
        getSelection,
        getSelectedText,
        focus: () => {
          const firstEditableBlock = blocks.find((block) => block.kind !== "divider");
          const firstElement = firstEditableBlock ? blockRefs.current.get(firstEditableBlock.id) : null;
          firstElement?.focus();
        },
        setSelectionRange: (start, end) => {
          const target = getBlockOffsets().find((offset) => start >= offset.start && start <= offset.end);
          if (!target) return;

          const element = blockRefs.current.get(target.id);
          if (!element) return;

          const contentOffset = Math.max(0, start - target.start - getBlockPrefixLength(target.block));
          activeBlockIdRef.current = target.id;
          element.focus();
          setElementSelection(element, contentOffset);

          if (end !== start) {
            onSelectionChange(markdownValue.slice(start, end).trim().slice(0, 6000));
          }
        }
      }),
      [blocks, getBlockOffsets, getSelectedText, getSelection, markdownValue, onSelectionChange]
    );

    function emitBlocks(nextBlocks: MarkdownBlock[]) {
      const nextValue = serializeMarkdownBlocks(nextBlocks);
      setBlocks(nextBlocks);
      lastEmittedValueRef.current = nextValue;
      onChange(nextValue);
    }

    function handleBlockInput(block: MarkdownBlock, index: number, element: HTMLElement) {
      const nextEditableBlocks = parseEditableText(element.innerText.replace(/\n$/, ""), block);
      const nextBlocks = [
        ...blocks.slice(0, index),
        ...nextEditableBlocks,
        ...blocks.slice(index + 1)
      ];
      activeBlockIdRef.current = nextEditableBlocks[0]?.id ?? block.id;
      emitBlocks(nextBlocks);
    }

    function handlePaste(event: ClipboardEvent<HTMLElement>, block: MarkdownBlock, index: number) {
      const text = event.clipboardData.getData("text/plain");
      if (!text.includes("\n")) {
        return;
      }

      event.preventDefault();
      const nextEditableBlocks = parseMarkdownToBlocks(text);
      const nextBlocks = [...blocks.slice(0, index), ...nextEditableBlocks, ...blocks.slice(index + 1)];
      activeBlockIdRef.current = nextEditableBlocks[0]?.id ?? block.id;
      emitBlocks(nextBlocks);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLElement>, block: MarkdownBlock, index: number) {
      if (event.key !== "Enter" || event.shiftKey || block.kind === "code-block") {
        return;
      }

      event.preventDefault();
      const nextBlock =
        block.kind === "unordered-list" || block.kind === "ordered-list" || block.kind === "checklist"
          ? createBlock({ ...block, text: "", order: block.kind === "ordered-list" ? (block.order ?? 1) + 1 : block.order })
          : createBlock({ kind: "paragraph", text: "" });
      const nextBlocks = [...blocks.slice(0, index + 1), nextBlock, ...blocks.slice(index + 1)];
      activeBlockIdRef.current = nextBlock.id;
      emitBlocks(nextBlocks);
      requestAnimationFrame(() => blockRefs.current.get(nextBlock.id)?.focus());
    }

    if (readOnly) {
      return null;
    }

    return (
      <div
        className={`editable-markdown markdown-body ${className}`}
        role="textbox"
        aria-label="Editor visual de markdown"
        aria-multiline="true"
        data-empty={renderedMarkdown.trim().length === 0 ? "true" : "false"}
      >
        {blocks.map((block, index) => {
          if (block.kind === "divider") {
            return (
              <button
                key={block.id}
                type="button"
                className={getBlockClassName(block)}
                onFocus={() => {
                  activeBlockIdRef.current = block.id;
                  onSelectionChange("");
                }}
              >
                <span />
              </button>
            );
          }

          return (
            <div
              key={block.id}
              ref={(element) => {
                if (element) blockRefs.current.set(block.id, element);
                else blockRefs.current.delete(block.id);
              }}
              className={getBlockClassName(block)}
              contentEditable
              suppressContentEditableWarning
              data-placeholder={index === 0 ? placeholder : ""}
              spellCheck
              onFocus={() => {
                activeBlockIdRef.current = block.id;
                onSelectionChange("");
              }}
              onInput={(event) => handleBlockInput(block, index, event.currentTarget)}
              onKeyDown={(event) => handleKeyDown(event, block, index)}
              onPaste={(event) => handlePaste(event, block, index)}
              onMouseUp={() => onSelectionChange(getSelectedText().trim().slice(0, 6000))}
              onKeyUp={() => onSelectionChange(getSelectedText().trim().slice(0, 6000))}
            >
              {block.text}
            </div>
          );
        })}
      </div>
    );
  }
);

EditableMarkdownPreview.displayName = "EditableMarkdownPreview";
