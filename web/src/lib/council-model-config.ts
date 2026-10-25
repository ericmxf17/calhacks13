import { ReasoningEffort } from '@factory/droid-sdk/node'
import type { CouncilModel, CouncilRole } from './council-types'

export const councilRoles = ['finance', 'operations', 'skeptic', 'chair'] as const

// Each setting can be overridden independently; existing shared setups retain
// their explicit model selection. Never supply a billable model by default.
export function councilModelConfiguration(env: NodeJS.ProcessEnv = process.env): Record<CouncilRole, CouncilModel> {
  return Object.fromEntries(councilRoles.map(role => {
    const prefix = `COUNCIL_${role.toUpperCase()}`
    return [role, {
      modelId: env[`${prefix}_MODEL_ID`]?.trim() || env.COUNCIL_MODEL_ID?.trim() || '',
      reasoningEffort: env[`${prefix}_REASONING_EFFORT`]?.trim() || env.COUNCIL_REASONING_EFFORT?.trim() || '',
    }]
  })) as Record<CouncilRole, CouncilModel>
}

export function councilModelConfigured(model: CouncilModel): model is CouncilModel & { reasoningEffort: ReasoningEffort } {
  return !!model.modelId && Object.values(ReasoningEffort).includes(model.reasoningEffort as ReasoningEffort)
}
