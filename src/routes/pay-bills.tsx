import { createFileRoute } from "@tanstack/react-router";
import { ReceiptText } from "lucide-react";
import { FeatureStatePage } from "@/components/feature-state-page";

export const Route = createFileRoute("/pay-bills")({
  component: () => <FeatureStatePage title="Pay Bills" icon={ReceiptText} comingSoon />,
});
