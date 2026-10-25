import { validateBusiness, type BusinessInput } from './business-input'
import { demoCompanies } from './demo-companies'

/** A demo flag or a company name alone does not grant access to saved examples. */
export function councilDemoId(business: BusinessInput): string | null {
  const profile = JSON.stringify(validateBusiness(business))
  return demoCompanies.find(demo => JSON.stringify(validateBusiness(demo.business)) === profile)?.id ?? null
}
