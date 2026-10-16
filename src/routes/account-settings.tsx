import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { FeatureStatePage } from "@/components/feature-state-page";

export const Route = createFileRoute("/account-settings")({
  component: () => <FeatureStatePage title="Account Settings" icon={Settings} />,
});
