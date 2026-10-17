import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { siteConfig } from "@/lib/site-config";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches the Contact page and exposes the approved contact details", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/contact");

    expect(matches.at(-1)?.routeId).toBe("/contact");
    expect(siteConfig.contacts).toEqual({
      whatsappCommunity: "https://chat.whatsapp.com/Jo0Ax9U6fHa4l7p9fdAG0n",
      telegram: "https://t.me/besttplug",
      whatsappDirect: "https://wa.me/08114723266",
      location: "Lagos",
    });
  });

  it("matches each dashboard navigation destination", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const paths = [
      "/",
      "/how-it-works",
      "/products",
      "/cart",
      "/wishlist",
      "/recently-viewed",
      "/wallet",
      "/account-settings",
      "/contact",
      "/sms-verify",
      "/pay-bills",
      "/boost-accounts",
      "/refer-earn",
      "/leaderboard",
    ];

    for (const path of paths) {
      expect(router.matchRoutes(path).at(-1)?.routeId, path).not.toBe(rootRouteId);
    }
  });
});
