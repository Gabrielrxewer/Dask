import { getCustomerDisplayName, type Customer, type CustomerStatus, type CreateCustomerInput } from "@/modules/workspace";
import { FormField, Select, Textarea, TextInput } from "@/shared/ui";

export function CustomerForm({ value, duplicates, onChange, onLinkDuplicate }: {
  value: CreateCustomerInput;
  duplicates: Customer[];
  onChange: (value: CreateCustomerInput) => void;
  onLinkDuplicate: (customer: Customer) => void;
}) {
  const updateAddress = (field: keyof NonNullable<CreateCustomerInput["address"]>, nextValue: string) => {
    onChange({ ...value, address: { ...(value.address ?? {}), [field]: nextValue } });
  };
  return (
    <>
      <div className="leads-page__form-grid shared-form-grid shared-form-grid--three">
        <FormField label="Nome *"><TextInput value={value.name ?? ""} onChange={(e) => onChange({ ...value, name: e.target.value })} /></FormField>
        <FormField label="Nome fantasia"><TextInput value={value.tradeName ?? ""} onChange={(e) => onChange({ ...value, tradeName: e.target.value })} /></FormField>
        <FormField label="RazÃ£o social"><TextInput value={value.legalName ?? ""} onChange={(e) => onChange({ ...value, legalName: e.target.value })} /></FormField>
      </div>
      <div className="leads-page__form-grid shared-form-grid shared-form-grid--three">
        <FormField label="CNPJ / CPF"><TextInput value={value.document ?? ""} onChange={(e) => onChange({ ...value, document: e.target.value })} /></FormField>
        <FormField label="InscriÃ§Ã£o estadual"><TextInput value={value.stateRegistration ?? ""} onChange={(e) => onChange({ ...value, stateRegistration: e.target.value })} /></FormField>
        <FormField label="InscriÃ§Ã£o municipal"><TextInput value={value.municipalRegistration ?? ""} onChange={(e) => onChange({ ...value, municipalRegistration: e.target.value })} /></FormField>
      </div>
      <div className="leads-page__form-grid shared-form-grid shared-form-grid--three">
        <FormField label="Regime tributÃ¡rio"><TextInput value={value.taxRegime ?? ""} onChange={(e) => onChange({ ...value, taxRegime: e.target.value })} /></FormField>
        <FormField label="E-mail"><TextInput value={value.email ?? ""} onChange={(e) => onChange({ ...value, email: e.target.value })} /></FormField>
        <FormField label="Telefone"><TextInput value={value.phone ?? ""} onChange={(e) => onChange({ ...value, phone: e.target.value })} /></FormField>
      </div>
      <div className="leads-page__form-grid shared-form-grid shared-form-grid--three">
        <FormField label="Website"><TextInput value={value.website ?? ""} onChange={(e) => onChange({ ...value, website: e.target.value })} /></FormField>
        <FormField label="Logo URL"><TextInput value={value.logoUrl ?? ""} onChange={(e) => onChange({ ...value, logoUrl: e.target.value })} /></FormField>
        <FormField label="Status">
          <Select value={value.status ?? "prospect"} onChange={(e) => onChange({ ...value, status: e.target.value as CustomerStatus })}>
            <option value="prospect">Prospect</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="archived">Arquivado</option>
          </Select>
        </FormField>
      </div>
      <div className="leads-page__form-grid shared-form-grid shared-form-grid--three">
        <FormField label="EndereÃ§o"><TextInput value={value.address?.street ?? ""} onChange={(e) => updateAddress("street", e.target.value)} /></FormField>
        <FormField label="NÃºmero"><TextInput value={value.address?.number ?? ""} onChange={(e) => updateAddress("number", e.target.value)} /></FormField>
        <FormField label="Complemento"><TextInput value={value.address?.complement ?? ""} onChange={(e) => updateAddress("complement", e.target.value)} /></FormField>
      </div>
      <div className="leads-page__form-grid shared-form-grid shared-form-grid--three">
        <FormField label="Cidade"><TextInput value={value.address?.city ?? ""} onChange={(e) => updateAddress("city", e.target.value)} /></FormField>
        <FormField label="Estado"><TextInput value={value.address?.state ?? ""} onChange={(e) => updateAddress("state", e.target.value)} /></FormField>
        <FormField label="CEP"><TextInput value={value.address?.zipCode ?? ""} onChange={(e) => updateAddress("zipCode", e.target.value)} /></FormField>
      </div>
      <FormField label="ObservaÃ§Ãµes"><Textarea rows={3} value={value.notes ?? ""} onChange={(e) => onChange({ ...value, notes: e.target.value })} /></FormField>
      {duplicates.length > 0 ? (
        <div className="leads-page__duplicates">
          <span className="leads-page__eyebrow">PossÃ­veis duplicados â€” clique para vincular</span>
          {duplicates.slice(0, 4).map((customer) => (
            <button key={customer.id} type="button" className="leads-duplicate-btn" onClick={() => onLinkDuplicate(customer)}>
              <div className="leads-customer-avatar"><span>{getCustomerDisplayName(customer).slice(0, 2).toUpperCase()}</span></div>
              <div>
                <strong>{getCustomerDisplayName(customer)}</strong>
                <span>{customer.email ?? customer.phone ?? customer.document ?? "Cliente existente"}</span>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
