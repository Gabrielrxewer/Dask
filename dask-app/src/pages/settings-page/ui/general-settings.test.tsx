import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceRole, WorkspaceSnapshot } from "@/modules/workspace/model";
import { GeneralSettings } from "./general-settings";

const testState = vi.hoisted(() => ({
  role: "OWNER" as WorkspaceRole,
  useConnectAccountQuery: vi.fn(),
  useCreateConnectAccountMutation: vi.fn(),
  useUpdateWorkspaceProfileMutation: vi.fn(),
  useWorkspaceProfileQuery: vi.fn(),
  useWorkspaceSettings: vi.fn(),
  useWorkspaceSettingsPermissions: vi.fn(),
  useWorkspaceSummaryQuery: vi.fn(),
  useWorkspaceTemplatesQuery: vi.fn()
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ workspaceSlug: "acme" })
  };
});

vi.mock("@/modules/billing", async () => {
  const actual = await vi.importActual<typeof import("@/modules/billing")>("@/modules/billing");
  return {
    ...actual,
    useConnectAccountQuery: testState.useConnectAccountQuery,
    useCreateConnectAccountMutation: testState.useCreateConnectAccountMutation
  };
});

vi.mock("@/modules/workspace", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workspace")>("@/modules/workspace");
  return {
    ...actual,
    useUpdateWorkspaceProfileMutation: testState.useUpdateWorkspaceProfileMutation,
    useWorkspaceProfileQuery: testState.useWorkspaceProfileQuery,
    useWorkspaceSettings: testState.useWorkspaceSettings,
    useWorkspaceSettingsPermissions: testState.useWorkspaceSettingsPermissions,
    useWorkspaceSummaryQuery: testState.useWorkspaceSummaryQuery,
    useWorkspaceTemplatesQuery: testState.useWorkspaceTemplatesQuery
  };
});

function makeSnapshot(role: WorkspaceRole): WorkspaceSnapshot {
  return {
    id: "workspace-1",
    access: { role, isClient: false },
    boardConfig: {
      statuses: [],
      taskTypes: [],
      fieldDefinitions: [],
      perspectives: []
    },
    tasks: [],
    preferences: {
      defaultBoardMode: "",
      dateFormat: "dd/mm/yyyy",
      settings: {}
    },
    membersById: {}
  } as unknown as WorkspaceSnapshot;
}

function renderSettings(role: WorkspaceRole) {
  testState.role = role;
  return renderToStaticMarkup(
    <MemoryRouter>
      <GeneralSettings />
    </MemoryRouter>
  );
}

describe("GeneralSettings Connect permissions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const workspace = await vi.importActual<typeof import("@/modules/workspace")>("@/modules/workspace");
    const mutation = { mutateAsync: vi.fn(), isPending: false };

    testState.useWorkspaceSettings.mockImplementation(() => ({
      snapshot: makeSnapshot(testState.role),
      settings: {},
      updatePreferences: vi.fn(),
      resetWorkspaceTemplate: vi.fn()
    }));
    testState.useWorkspaceSettingsPermissions.mockImplementation(() =>
      workspace.resolveWorkspaceSettingsPermissions(testState.role, false)
    );
    testState.useWorkspaceSummaryQuery.mockReturnValue({ data: { kind: "CORPORATE" }, isLoading: false });
    testState.useWorkspaceTemplatesQuery.mockReturnValue({ data: [], isLoading: false, isError: false });
    testState.useWorkspaceProfileQuery.mockReturnValue({
      data: {
        id: "workspace-1",
        name: "Acme",
        key: "ACME",
        kind: "CORPORATE",
        info: { description: "", company: "", website: "" }
      },
      isError: false
    });
    testState.useUpdateWorkspaceProfileMutation.mockReturnValue({ mutateAsync: vi.fn() });
    testState.useConnectAccountQuery.mockReturnValue({
      data: null,
      error: null,
      isLoading: false,
      isError: false
    });
    testState.useCreateConnectAccountMutation.mockReturnValue(mutation);
  });

  it("keeps sensitive Connect onboarding enabled for OWNER", () => {
    const html = renderSettings("OWNER");

    expect(testState.useCreateConnectAccountMutation).toHaveBeenCalledWith("workspace-1");
    expect(html).toContain("Completar cadastro");
    expect(html).not.toContain("Apenas o proprietario do workspace pode alterar a configuracao sensivel do Stripe Connect.");
  });

  it.each(["ADMIN", "MEMBER"] as const)("blocks sensitive Connect onboarding for %s", (role) => {
    const html = renderSettings(role);

    expect(testState.useCreateConnectAccountMutation).toHaveBeenCalledWith(null);
    expect(html).toContain("Completar cadastro");
    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("Apenas o proprietario do workspace pode alterar a configuracao sensivel do Stripe Connect.");
  });
});
