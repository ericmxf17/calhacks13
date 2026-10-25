// Public agent identities shared by the server registry and the browser grid.
export const agentCatalog = [
  { role: 'bill-analyst', name: 'Bill Analyst', description: 'Reads a bill and turns its provisions into a structured fact sheet.', avatar: 'bill-analyst' },
  { role: 'researcher', name: 'Bill Researcher', description: 'Finds sources, stakeholder views, and policy context for a bill.', avatar: 'researcher' },
  { role: 'impact-planner', name: 'Bill Impact Planner', description: 'Builds company-specific scenarios and options to evaluate their business impact.', avatar: 'impact-planner' },
  { role: 'brief-writer', name: 'Brief Writer', description: 'Turns the analysis, research, and company impact into a concise decision brief.', avatar: 'researcher' },
  { role: 'scene-designer', name: 'Scene Designer', description: 'Designs each new company’s 3D building and rooms from its profile.', avatar: 'impact-planner' },
] as const

export type AgentRole = typeof agentCatalog[number]['role']
