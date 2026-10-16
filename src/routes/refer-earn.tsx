import { createFileRoute } from "@tanstack/react-router";
import { Gift } from "lucide-react";
import { FeatureStatePage } from "@/components/feature-state-page";

export const Route = createFileRoute("/refer-earn")({
  component: () => <FeatureStatePage title="Refer & Earn" icon={Gift} />,
});
