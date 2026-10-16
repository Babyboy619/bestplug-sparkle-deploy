import { createFileRoute } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { FeatureStatePage } from "@/components/feature-state-page";

export const Route = createFileRoute("/wishlist")({
  component: () => <FeatureStatePage title="Wishlist" icon={Heart} />,
});
