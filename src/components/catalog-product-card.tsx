import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Product = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  "id" | "title" | "slug" | "description" | "price" | "currency" | "stock" | "image_url"
>;

export function CatalogProductCard({ product }: { product: Product }) {
  const { user } = useAuthUser();
  const navigate = useNavigate();
  const [wishlisted, setWishlisted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user) {
      setWishlisted(false);
      return;
    }
    void supabase
      .from("wishlists")
      .select("product_id")
      .eq("user_id", user.id)
      .eq("product_id", product.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setWishlisted(Boolean(data));
      });
    return () => {
      active = false;
    };
  }, [product.id, user]);

  async function toggleWishlist() {
    if (!user) {
      toast.message("Sign in to save products to your wishlist.");
      void navigate({ to: "/auth" });
      return;
    }
    setBusy(true);
    const result = wishlisted
      ? await supabase
          .from("wishlists")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", product.id)
      : await supabase.from("wishlists").insert({ user_id: user.id, product_id: product.id });
    setBusy(false);
    if (result.error) {
      toast.error("Your wishlist could not be updated. Please try again.");
      return;
    }
    setWishlisted(!wishlisted);
    toast.success(wishlisted ? "Removed from wishlist." : "Added to wishlist.");
  }

  async function addToCart() {
    if (!user) {
      toast.message("Sign in to add products to your cart.");
      void navigate({ to: "/auth" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("add_cart_item", {
      _product_id: product.id,
      _quantity: 1,
    });
    setBusy(false);
    if (error) {
      toast.error(
        error.message.includes("unavailable")
          ? "This product is out of stock."
          : "The product could not be added to your cart.",
      );
      return;
    }
    window.dispatchEvent(new Event("bestplug-cart-updated"));
    toast.success("Added to cart.");
  }

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative">
        {product.image_url ? (
          <img src={product.image_url} alt="" className="aspect-[16/9] w-full object-cover" />
        ) : (
          <div aria-hidden="true" className="aspect-[16/9] w-full bg-secondary" />
        )}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={
            wishlisted
              ? `Remove ${product.title} from wishlist`
              : `Add ${product.title} to wishlist`
          }
          aria-pressed={wishlisted}
          disabled={busy}
          onClick={() => void toggleWishlist()}
          className="absolute right-3 top-3 size-10 rounded-full bg-background/90 shadow"
        >
          <Heart className={wishlisted ? "fill-rose-500 text-rose-500" : "text-foreground"} />
        </Button>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h2 className="line-clamp-2 font-semibold">{product.title}</h2>
        {product.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">
            {product.description}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div>
            <p className="font-semibold">
              {new Intl.NumberFormat("en-NG", {
                style: "currency",
                currency: product.currency || "NGN",
                maximumFractionDigits: 2,
              }).format(Number(product.price))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {product.stock > 0 ? `${product.stock} available` : "Out of stock"}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={`Add ${product.title} to cart`}
            disabled={busy || product.stock < 1}
            onClick={() => void addToCart()}
          >
            <ShoppingCart aria-hidden="true" />
          </Button>
        </div>
        <Button asChild variant="ghost" className="mt-2 justify-between px-0">
          <Link to="/products/$slug" params={{ slug: product.slug }}>
            View product <span aria-hidden="true">→</span>
          </Link>
        </Button>
      </div>
    </article>
  );
}
