export const AI_AGENT_CLOSE_REQUEST_EVENT = 'ristak-ai-agent-close-request'

export function requestAIAgentClose() {
  window.dispatchEvent(new Event(AI_AGENT_CLOSE_REQUEST_EVENT))
}
