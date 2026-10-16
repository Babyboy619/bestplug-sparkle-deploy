import { createFileRoute } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { FeatureStatePage } from "@/components/feature-state-page";

export const Route = createFileRoute("/cart")({
  component: () => <FeatureStatePage title="Cart" icon={ShoppingCart} />,
});
