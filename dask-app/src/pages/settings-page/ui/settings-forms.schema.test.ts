import { describe, expect, it } from "vitest";
import {
  accessGroupFormSchema,
  memberAccessFormSchema,
  workspaceInviteFormSchema
} from "./members-settings.model";
import { workspaceProfileSettingsFormSchema } from "./general-settings.model";
import { workflowStateFormSchema } from "./workflow-states-settings.model";

describe("settings form schemas", () => {
  it("normaliza convite de membro", () => {
    const result = workspaceInviteFormSchema.parse({
      email: "  USER@Example.COM ",
      role: "MEMBER"
    });

    expect(result).toEqual({
      email: "user@example.com",
      role: "MEMBER"
    });
  });

  it("valida acesso de membro sem perder arrays tipados", () => {
    const result = memberAccessFormSchema.parse({
      role: "ADMIN",
      allowOverrides: ["workspace.manage"],
      denyOverrides: [],
      groupIds: ["sales"],
      allowedModules: ["board", "settings"],
      boardViewKeys: "kanban, agenda",
      ownCardsOnly: false
    });

    expect(result.allowedModules).toEqual(["board", "settings"]);
    expect(result.allowOverrides).toEqual(["workspace.manage"]);
  });

  it("exige nome de grupo de acesso", () => {
    const result = accessGroupFormSchema.safeParse({
      name: " ",
      description: "",
      allow: [],
      deny: [],
      allowedModules: [],
      boardViewKeys: "",
      ownCardsOnly: false
    });

    expect(result.success).toBe(false);
  });

  it("gera slug padrao para estado de workflow", () => {
    const result = workflowStateFormSchema.parse({
      name: "Em Validação",
      slug: "",
      color: "var(--warning)",
      category: "Qualidade",
      order: "",
      isTerminal: false,
      isEditable: true,
      isActive: true
    });

    expect(result.slug).toBe("em-validacao");
    expect(result.order).toBe("0");
  });

  it("normaliza identidade do workspace e valida aviso previo", () => {
    const result = workspaceProfileSettingsFormSchema.safeParse({
      workspaceName: " Core ",
      workspaceKey: " core ",
      workspaceWebsite: "",
      workspaceDescription: "",
      workspaceCompany: "",
      companyProfile: {
        name: "Dask",
        legalName: "",
        document: "",
        address: "",
        jurisdictionCity: "",
        jurisdictionState: "",
        noticePeriod: "trinta"
      }
    });

    expect(result.success).toBe(false);

    const valid = workspaceProfileSettingsFormSchema.parse({
      workspaceName: " Core ",
      workspaceKey: " core ",
      workspaceWebsite: "",
      workspaceDescription: "",
      workspaceCompany: "",
      companyProfile: {
        name: "Dask",
        legalName: "",
        document: "",
        address: "",
        jurisdictionCity: "",
        jurisdictionState: "",
        noticePeriod: "30"
      }
    });

    expect(valid.workspaceKey).toBe("CORE");
  });
});
