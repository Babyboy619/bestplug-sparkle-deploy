import { createFileRoute } from "@tanstack/react-router";
import { Rocket } from "lucide-react";
import { FeatureStatePage } from "@/components/feature-state-page";

export const Route = createFileRoute("/boost-accounts")({
  component: () => <FeatureStatePage title="Boost Accounts" icon={Rocket} comingSoon />,
});
