import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/metadata";
import { SavedProductsPage } from "@/components/saved-products-page";

export const Route = createFileRoute("/recently-viewed")({
  head: () => pageHead("Recently Viewed", "Review marketplace products you have viewed recently."),
  component: () => <SavedProductsPage mode="recentlyViewed" />,
});
