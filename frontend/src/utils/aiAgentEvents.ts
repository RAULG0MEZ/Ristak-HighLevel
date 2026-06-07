export const AI_AGENT_CLOSE_REQUEST_EVENT = 'ristak-ai-agent-close-request'
export const AI_AGENT_OPEN_REQUEST_EVENT = 'ristak-ai-agent-open-request'

export type AIAgentSitesCreationKind = 'landing' | 'form' | 'interactive_form'
export type AIAgentSitesCreationMode = 'builder' | 'html'

export interface AIAgentOpenRequestDetail {
  sitesCreation?: {
    siteKind: AIAgentSitesCreationKind
    creationMode?: AIAgentSitesCreationMode
    editSiteId?: string
    metaCapiEnabled?: boolean
    siteTitle?: string
  }
}

export function requestAIAgentClose() {
  window.dispatchEvent(new Event(AI_AGENT_CLOSE_REQUEST_EVENT))
}

export function requestAIAgentOpen(detail: AIAgentOpenRequestDetail = {}) {
  window.dispatchEvent(new CustomEvent<AIAgentOpenRequestDetail>(AI_AGENT_OPEN_REQUEST_EVENT, {
    detail
  }))
}
