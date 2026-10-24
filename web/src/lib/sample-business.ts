import type { BusinessInput } from './business-input'
import { findDemoCompany } from './demo-companies'

/**
 * VoltRide's details, so new owners can try every setup step without their own spreadsheets.
 * Its supplier rows count as an uploaded sheet, so step 3 shows them like a real upload.
 */
export const sampleBusiness: BusinessInput = { ...structuredClone(findDemoCompany('voltride')!.business), demo: false }

/** The name the sample spreadsheet shows under, as if it had been uploaded. */
export const sampleFileName = 'voltride-suppliers.csv'
