import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, type LucideIcon } from "lucide-react";
import { SiteFrame } from "@/components/site-frame";
import { Button } from "@/components/ui/button";

export function FeatureStatePage({
  title,
  icon: Icon,
  comingSoon = false,
}: {
  title: string;
  icon: LucideIcon;
  comingSoon?: boolean;
}) {
  return (
    <SiteFrame>
      <main className="mx-auto flex min-h-[65vh] max-w-4xl flex-col justify-center px-5 py-12 sm:px-8">
        <div className="max-w-xl rounded-xl border border-border bg-card p-6 sm:p-8">
          <Icon aria-hidden="true" className="size-8 text-primary" />
          <h1 className="mt-5 text-2xl font-bold">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {comingSoon
              ? "Coming Soon"
              : "This feature is not available yet. No activity or account data is being simulated."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/">
                <ArrowLeft aria-hidden="true" /> Dashboard
              </Link>
            </Button>
            {!comingSoon && (
              <Button asChild variant="outline">
                <Link to="/products">
                  Browse accounts <ArrowUpRight aria-hidden="true" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </main>
    </SiteFrame>
  );
}
