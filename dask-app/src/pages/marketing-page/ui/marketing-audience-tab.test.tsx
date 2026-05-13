import { renderToStaticMarkup } from "react-dom/server";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import type { MarketingAudienceContact, MarketingSegment } from "@/modules/marketing";
import { MarketingAudienceTab } from "./marketing-audience-tab";
import type { SegmentFilterRule, SegmentFormState, SegmentPreviewState } from "./marketing-page.model";

const audienceContact: MarketingAudienceContact = {
  contact: {
    id: "contact-1",
    workItemId: "workitem-1",
    fullName: "Ana Cliente",
    email: "ana@example.com",
    companyName: "Acme",
    status: "QUALIFIED",
    score: 82,
    captureSource: "site",
    updatedAt: "2026-05-10T12:00:00.000Z"
  },
  preference: {
    consentStatus: "OPTED_IN",
    allowEmail: true,
    allowNewsletter: true,
    allowBilling: false
  },
  lastEventAt: "2026-05-12T12:00:00.000Z"
};

const segment: MarketingSegment = {
  id: "segment-1",
  name: "Score alto",
  description: null,
  kind: "DYNAMIC",
  isActive: true,
  estimatedContacts: 12,
  filters: {
    logic: "AND",
    rules: [{ field: "score", operator: "gte", value: 60 }]
  }
};

const segmentPreview: SegmentPreviewState = {
  segmentName: "Score alto",
  estimatedContacts: 12,
  sample: [audienceContact.contact]
};

const segmentFilterRule: SegmentFilterRule = {
  field: "score",
  operator: "gte",
  value: "60"
};

function MarketingAudienceTabFixture({
  audience = [audienceContact],
  isLoading = false,
  error,
  preview = segmentPreview
}: {
  audience?: MarketingAudienceContact[];
  isLoading?: boolean;
  error?: unknown;
  preview?: SegmentPreviewState | null;
}) {
  const segmentForm = useForm<SegmentFormState>({
    defaultValues: {
      name: "Score alto",
      description: "",
      kind: "DYNAMIC",
      filtersText: JSON.stringify({ logic: "AND", rules: [{ field: "score", operator: "gte", value: 60 }] })
    }
  });

  return (
    <MarketingAudienceTab
      audience={audience}
      segments={[segment]}
      audienceSearch="ana"
      setAudienceSearch={() => undefined}
      segmentFormControl={segmentForm.control}
      segmentFormErrors={segmentForm.formState.errors}
      segmentPreview={preview}
      segmentFilterRule={segmentFilterRule}
      updateSegmentFilterRule={() => undefined}
      isLoading={isLoading}
      error={error}
      isSubmitting={false}
      loadData={async () => undefined}
      createSegment={async () => undefined}
      previewSegment={async () => undefined}
    />
  );
}

describe("MarketingAudienceTab", () => {
  it("renderiza Audiência em seção própria com DataTable compartilhada", () => {
    const html = renderToStaticMarkup(<MarketingAudienceTabFixture />);

    expect(html).toContain("mkt-table-section--audience");
    expect(html).toContain("Audiência");
    expect(html).toContain("shared-data-table");
    expect(html).toContain("Ana Cliente");
    expect(html).toContain("ana@example.com");
    expect(html).toContain("Acme");
    expect(html).toContain("Contato");
    expect(html).toContain("Empresa");
    expect(html).toContain("Score");
    expect(html).toContain("Consentimento");
    expect(html).toContain("Último evento");
    expect(html).toContain("Recarregar");
    expect(html).toContain("value=\"ana\"");
  });

  it("preserva loading, empty e error states da Audiência", () => {
    const loading = renderToStaticMarkup(<MarketingAudienceTabFixture audience={[]} isLoading />);
    const empty = renderToStaticMarkup(<MarketingAudienceTabFixture audience={[]} preview={null} />);
    const error = renderToStaticMarkup(
      <MarketingAudienceTabFixture audience={[]} error={new Error("Falha na audiencia")} />
    );

    expect(loading).toContain("Carregando audiencia...");
    expect(loading).toContain("shared-loading-state");
    expect(empty).toContain("Nenhum contato encontrado");
    expect(empty).toContain("shared-data-table__row--empty");
    expect(error).toContain("Falha na audiencia");
    expect(error).toContain("shared-empty-state--error");
  });
});
