import { describe, expect, it } from "vitest";
import { factoryBoardConfig } from "@/entities/task/model/board-config";
import type { TaskFieldDefinition } from "@/entities/task/model/types";
import { validateTaskFieldPresentationValue } from "@/entities/task/ui/field-presentation/field-type-specs";

const baseTextField: TaskFieldDefinition = {
  id: "contactEmail",
  definitionId: "field-contact-email",
  label: "Email do contato",
  slug: "contactEmail",
  type: "text"
};

describe("field-type-specs", () => {
  it("valida semantica de texto apenas quando o schema declara config.semantic", () => {
    expect(
      validateTaskFieldPresentationValue({
        field: baseTextField,
        value: "email-invalido",
        boardConfig: factoryBoardConfig,
        statuses: factoryBoardConfig.statuses
      })
    ).toBeNull();

    expect(
      validateTaskFieldPresentationValue({
        field: {
          ...baseTextField,
          config: { semantic: "email" }
        },
        value: "email-invalido",
        boardConfig: factoryBoardConfig,
        statuses: factoryBoardConfig.statuses
      })
    ).toBe("Informe um email valido.");
  });
});
