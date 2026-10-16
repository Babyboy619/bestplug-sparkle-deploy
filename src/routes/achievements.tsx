import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { FeatureStatePage } from "@/components/feature-state-page";

export const Route = createFileRoute("/achievements")({
  component: () => <FeatureStatePage title="Achievements" icon={Trophy} />,
});
