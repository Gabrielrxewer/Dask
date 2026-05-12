import { Button } from "@/shared/ui";

const DEFAULT_VARIABLES = [
  "{{contact.firstName}}",
  "{{contact.fullName}}",
  "{{contact.email}}",
  "{{contact.companyName}}",
  "{{campaign.name}}",
  "{{workspace.name}}"
];

interface EmailVariablePickerProps {
  variables?: string[];
  onPick: (variable: string) => void;
}

export function EmailVariablePicker({ variables = DEFAULT_VARIABLES, onPick }: EmailVariablePickerProps) {
  return (
    <div className="mkt-email-variable-picker" aria-label="Variaveis do template">
      {variables.map((variable) => (
        <Button
          key={variable}
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPick(variable)}
        >
          {variable}
        </Button>
      ))}
    </div>
  );
}
