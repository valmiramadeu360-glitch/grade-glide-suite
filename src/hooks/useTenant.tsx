/**
 * Ponte do "tenant" (a universidade do estudante).
 *
 * O código do app inteiro importa `@/hooks/useTenant`, mas a implementação real
 * mora em `@/contexts/TenantContext`. Este arquivo só reexporta, para que os dois
 * caminhos funcionem e nada mais quebre no build.
 */
export {
  TenantProvider,
  useTenant,
  type TenantProfile,
  type TenantUniversity,
} from "@/contexts/TenantContext";
