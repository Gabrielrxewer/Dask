import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentationTopNavigation } from "./documentation-top-navigation";

const noop = () => undefined;

function renderNavigation(canSendCommercialDocument: boolean) {
  return renderToStaticMarkup(
    <DocumentationTopNavigation
      fromCard={false}
      disabled={false}
      isAssistantOpen={false}
      hasActiveDoc
      canDeleteDoc
      canSendCommercialDocument={canSendCommercialDocument}
      onBack={noop}
      onCreate={noop}
      onSendCommercialDocument={noop}
      onToggleAssistant={noop}
      onDuplicate={noop}
      onDelete={noop}
    />
  );
}

describe("DocumentationTopNavigation", () => {
  it("shows the customer send action for commercial documents", () => {
    const html = renderNavigation(true);

    expect(html).toContain('aria-label="Enviar para cliente"');
  });

  it("does not show the customer send action for wiki documents", () => {
    const html = renderNavigation(false);

    expect(html).not.toContain('aria-label="Enviar para cliente"');
  });
});
