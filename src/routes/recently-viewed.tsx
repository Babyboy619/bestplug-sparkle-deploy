import { createFileRoute } from "@tanstack/react-router";
import { Clock3 } from "lucide-react";
import { FeatureStatePage } from "@/components/feature-state-page";

export const Route = createFileRoute("/recently-viewed")({
  component: () => <FeatureStatePage title="Recently Viewed" icon={Clock3} />,
});
