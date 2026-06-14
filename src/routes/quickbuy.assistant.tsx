import { createFileRoute } from "@tanstack/react-router";
import { AssistantPanel } from "@/components/quickbuy/AssistantPanel";

export const Route = createFileRoute("/quickbuy/assistant")({
  component: AssistantFullPage,
});

function AssistantFullPage() {
  return (
    <div className="h-[calc(100vh-7rem)] overflow-hidden rounded-2xl border bg-card">
      <AssistantPanel />
    </div>
  );
}
