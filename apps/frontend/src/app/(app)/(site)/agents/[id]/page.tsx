import { Metadata } from 'next';
import { Agent } from '@xpoz/frontend/components/agents/agent';
import { AgentChat } from '@xpoz/frontend/components/agents/agent.chat';
export const metadata: Metadata = {
  title: 'XPoz - Agent',
  description: '',
};
export default async function Page() {
  return (
    <AgentChat />
  );
}
