import { createFileRoute } from "@tanstack/react-router";
import { Smartphone } from "lucide-react";
import { FeatureStatePage } from "@/components/feature-state-page";

export const Route = createFileRoute("/sms-verify")({
  component: () => <FeatureStatePage title="SMS Verify" icon={Smartphone} comingSoon />,
});
