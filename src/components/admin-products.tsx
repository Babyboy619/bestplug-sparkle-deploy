import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  adminAddProductInventory,
  adminArchiveProduct,
  adminProductActivity,
  adminProductInventoryCount,
  adminSaveProduct,
  adminSearchProducts,
} from "@/lib/admin.functions";

type ProductResult = Awaited<ReturnType<typeof adminSearchProducts>>;
type AdminProduct = NonNullable<ProductResult["products"]>[number];
type ActivityResult = Awaited<ReturnType<typeof adminProductActivity>>;
type ProductStatus = "draft" | "published" | "unavailable";

type ProductForm = {
  id: string | null;
  title: string;
  categoryId: string;
  description: string;
  price: string;
  stock: string;
  imageUrl: string;
  status: ProductStatus;
  specifications: string;
  deliveryInstructions: string;
};

const emptyForm: ProductForm = {
  id: null,
  title: "",
  categoryId: "",
  description: "",
  price: "",
  stock: "0",
  imageUrl: "",
  status: "draft",
  specifications: "",
  deliveryInstructions: "",
};

function productMetadata(product: AdminProduct): {
  specifications: Record<string, string>;
  deliveryInstructions: string;
} {
  const value = product.metadata;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { specifications: {}, deliveryInstructions: "" };
  }
  const rawSpecifications = value["specifications"];
  const specifications =
    typeof rawSpecifications === "object" &&
    rawSpecifications !== null &&
    !Array.isArray(rawSpecifications)
      ? Object.fromEntries(
          Object.entries(rawSpecifications).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : {};
  const instructions = value["delivery_instructions"];
  return {
    specifications,
    deliveryInstructions: typeof instructions === "string" ? instructions : "",
  };
}

const money = (value: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(value);

export function AdminProducts() {
  const searchProducts = useServerFn(adminSearchProducts);
  const saveProduct = useServerFn(adminSaveProduct);
  const archiveProduct = useServerFn(adminArchiveProduct);
  const loadActivity = useServerFn(adminProductActivity);
  const loadInventoryCount = useServerFn(adminProductInventoryCount);
  const addInventory = useServerFn(adminAddProductInventory);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | ProductStatus | "archived">("all");
  const [categoryId, setCategoryId] = useState("all");
  const [page, setPage] = useState(1);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [result, setResult] = useState<ProductResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AdminProduct | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [activityProduct, setActivityProduct] = useState<AdminProduct | null>(null);
  const [activity, setActivity] = useState<ActivityResult>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [inventoryProduct, setInventoryProduct] = useState<AdminProduct | null>(null);
  const [inventoryCount, setInventoryCount] = useState<number | null>(null);
  const [inventoryContent, setInventoryContent] = useState("");
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [inventoryReference, setInventoryReference] = useState<string | null>(null);
  const [inventoryConfirmationOpen, setInventoryConfirmationOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void searchProducts({
      data: {
        search,
        status,
        categoryId: categoryId === "all" ? null : categoryId,
        page,
        pageSize: 20,
      },
    })
      .then((next) => {
        if (active) setResult(next);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Products could not be loaded.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search, status, categoryId, page, refreshIndex, searchProducts]);

  useEffect(() => {
    if (!activityProduct) return;
    let active = true;
    setActivityLoading(true);
    void loadActivity({ data: { productId: activityProduct.id } })
      .then((items) => {
        if (active) setActivity(items);
      })
      .catch((cause: unknown) => {
        if (active)
          toast.error(cause instanceof Error ? cause.message : "Activity log unavailable.");
      })
      .finally(() => {
        if (active) setActivityLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activityProduct, refreshIndex, loadActivity]);

  const pageCount = Math.max(1, Math.ceil((result?.total ?? 0) / 20));

  function editProduct(product: AdminProduct) {
    const metadata = productMetadata(product);
    setForm({
      id: product.id,
      title: product.title,
      categoryId: product.category_id ?? "",
      description: product.description ?? "",
      price: String(product.price),
      stock: String(product.stock),
      imageUrl: product.image_url ?? "",
      status: product.product_status,
      specifications: Object.entries(metadata.specifications)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n"),
      deliveryInstructions: metadata.deliveryInstructions,
    });
    setFormError(null);
  }

  async function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    const specs: Record<string, string> = {};
    for (const line of form.specifications.split("\n")) {
      if (!line.trim()) continue;
      const separator = line.indexOf(":");
      if (separator <= 0 || !line.slice(separator + 1).trim()) {
        setFormError("Enter specifications one per line as “Name: value”.");
        return;
      }
      const key = line.slice(0, separator).trim();
      if (key.length > 100 || Object.hasOwn(specs, key)) {
        setFormError("Specification names must be unique and at most 100 characters.");
        return;
      }
      specs[key] = line.slice(separator + 1).trim();
    }
    if (Object.keys(specs).length > 20) {
      setFormError("A product can have at most 20 specifications.");
      return;
    }

    const price = Number(form.price);
    const stock = Number(form.stock);
    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      Math.abs(price * 100 - Math.round(price * 100)) >= 1e-7 ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      setFormError("Enter a positive NGN price and a non-negative whole-number stock quantity.");
      return;
    }
    if (form.imageUrl) {
      try {
        const parsed = new URL(form.imageUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      } catch {
        setFormError("Product images must use an HTTP or HTTPS URL.");
        return;
      }
    }

    setFormBusy(true);
    setFormError(null);
    try {
      await saveProduct({
        data: {
          id: form.id,
          title: form.title,
          categoryId: form.categoryId || null,
          description: form.description,
          price,
          stock,
          imageUrl: form.imageUrl,
          status: form.status,
          specifications: specs,
          deliveryInstructions: form.deliveryInstructions,
        },
      });
      toast.success(form.id ? "Product updated." : "Product created.");
      setForm(null);
      setRefreshIndex((value) => value + 1);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Product could not be saved.");
    } finally {
      setFormBusy(false);
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setArchiveBusy(true);
    try {
      const archived = archiveTarget.archived_at === null;
      await archiveProduct({ data: { productId: archiveTarget.id, archived } });
      toast.success(
        archived
          ? "Product archived. Existing orders and inventory are preserved."
          : "Product restored.",
      );
      setArchiveTarget(null);
      setRefreshIndex((value) => value + 1);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Product status could not be changed.");
    } finally {
      setArchiveBusy(false);
    }
  }

  async function openInventory(product: AdminProduct) {
    setInventoryProduct(product);
    setInventoryContent("");
    setInventoryReference(null);
    setInventoryCount(null);
    try {
      const count = await loadInventoryCount({ data: { productId: product.id } });
      setInventoryCount(count);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Delivery inventory could not be checked.",
      );
    }
  }

  async function confirmAddInventory() {
    if (!inventoryProduct || !inventoryContent.trim()) return;
    const reference = inventoryReference ?? crypto.randomUUID();
    setInventoryReference(reference);
    setInventoryBusy(true);
    try {
      const result = await addInventory({
        data: {
          productId: inventoryProduct.id,
          content: inventoryContent.trim(),
          reference,
        },
      });
      setInventoryCount((value) => (value ?? 0) + 1);
      setInventoryProduct({ ...inventoryProduct, stock: result.stock });
      setInventoryContent("");
      setInventoryReference(null);
      setInventoryConfirmationOpen(false);
      toast.success("One delivery record was added and stock updated.");
      setRefreshIndex((value) => value + 1);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Delivery inventory could not be added.",
      );
    } finally {
      setInventoryBusy(false);
    }
  }

  return (
    <section aria-labelledby="admin-products-heading" className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="admin-products-heading" className="text-2xl font-semibold">
            Product Management
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage real marketplace listings, pricing, stock, and secure delivery inventory.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setForm({ ...emptyForm });
            setFormError(null);
          }}
        >
          Create product
        </Button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Input
          aria-label="Search products by name"
          placeholder="Search product name"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <label className="text-sm">
          Product status
          <select
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as typeof status);
              setPage(1);
            }}
          >
            <option value="all">All active listings</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="unavailable">Unavailable</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="text-sm">
          Product category
          <select
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">All categories</option>
            {result?.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {!category.is_active || category.deleted_at ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-destructive p-3 text-sm" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground" role="status">
          Loading products…
        </p>
      ) : result?.products?.length ? (
        <>
          <div className="mt-5 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 font-semibold">Product</th>
                  <th className="p-3 font-semibold">Category</th>
                  <th className="p-3 font-semibold">Price</th>
                  <th className="p-3 font-semibold">Stock</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">Created</th>
                  <th className="p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.products.map((product) => (
                  <tr key={product.id} className="border-t border-border">
                    <td className="p-3">
                      <p className="font-medium">{product.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{product.slug}</p>
                    </td>
                    <td className="p-3">{product.product_categories?.name ?? "Uncategorized"}</td>
                    <td className="p-3">{money(Number(product.price))}</td>
                    <td className="p-3">{product.stock}</td>
                    <td className="p-3 capitalize">
                      {product.archived_at ? "Archived" : product.product_status}
                    </td>
                    <td className="p-3">{new Date(product.created_at).toLocaleDateString()}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {!product.archived_at && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => editProduct(product)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void openInventory(product)}
                            >
                              Add delivery
                            </Button>
                          </>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setActivityProduct(product)}
                        >
                          Activity
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={product.archived_at ? "outline" : "destructive"}
                          onClick={() => setArchiveTarget(product)}
                        >
                          {product.archived_at ? "Restore" : "Archive"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">
              {result.total} product{result.total === 1 ? "" : "s"} · Page {page} of {pageCount}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={page >= pageCount}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      ) : (
        !error && (
          <div className="mt-6 rounded-md border border-border p-5 text-sm text-muted-foreground">
            No products match these filters.
          </div>
        )
      )}

      <Dialog
        open={Boolean(form)}
        onOpenChange={(open) => {
          if (!open && !formBusy) setForm(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit product" : "Create product"}</DialogTitle>
            <DialogDescription>
              Product details are saved to the marketplace database. Image URLs must be HTTP or
              HTTPS.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <form className="space-y-4" onSubmit={(event) => void submitProduct(event)}>
              <label className="block text-sm">
                Product name
                <Input
                  className="mt-1"
                  required
                  maxLength={160}
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  Category
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                    value={form.categoryId}
                    onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                  >
                    <option value="">Uncategorized</option>
                    {result?.categories
                      .filter(
                        (category) =>
                          (category.is_active && !category.deleted_at) ||
                          category.id === form.categoryId,
                      )
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                          {!category.is_active || category.deleted_at ? " (inactive)" : ""}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Status
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                    value={form.status}
                    onChange={(event) =>
                      setForm({ ...form, status: event.target.value as ProductStatus })
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </label>
              </div>
              <label className="block text-sm">
                Description
                <textarea
                  className="mt-1 min-h-24 w-full rounded-md border border-input bg-background p-3"
                  maxLength={10000}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  Price (NGN)
                  <Input
                    className="mt-1"
                    type="number"
                    min="0.01"
                    max="100000000"
                    step="0.01"
                    required
                    value={form.price}
                    onChange={(event) => setForm({ ...form, price: event.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  Sellable stock
                  <Input
                    className="mt-1"
                    type="number"
                    min="0"
                    max="1000000"
                    step="1"
                    required
                    value={form.stock}
                    onChange={(event) => setForm({ ...form, stock: event.target.value })}
                  />
                </label>
              </div>
              <label className="block text-sm">
                Product image URL
                <Input
                  className="mt-1"
                  type="url"
                  maxLength={2048}
                  placeholder="https://…"
                  value={form.imageUrl}
                  onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
                />
              </label>
              <label className="block text-sm">
                Specifications{" "}
                <span className="text-muted-foreground">(one per line: Name: value)</span>
                <textarea
                  className="mt-1 min-h-24 w-full rounded-md border border-input bg-background p-3"
                  placeholder={"Platform: Instagram\nRegion: Nigeria"}
                  value={form.specifications}
                  onChange={(event) => setForm({ ...form, specifications: event.target.value })}
                />
              </label>
              <label className="block text-sm">
                Delivery instructions
                <textarea
                  className="mt-1 min-h-20 w-full rounded-md border border-input bg-background p-3"
                  maxLength={5000}
                  value={form.deliveryInstructions}
                  onChange={(event) =>
                    setForm({ ...form, deliveryInstructions: event.target.value })
                  }
                />
              </label>
              {formError && (
                <p className="rounded-md border border-destructive p-3 text-sm" role="alert">
                  {formError}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={formBusy}
                  onClick={() => setForm(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={formBusy}>
                  {formBusy ? "Saving…" : "Save product"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open && !archiveBusy) setArchiveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {archiveTarget?.archived_at ? "Restore product?" : "Archive product?"}
            </DialogTitle>
            <DialogDescription>
              {archiveTarget?.archived_at
                ? "Restoring makes this product visible according to its saved publication status."
                : "This removes the product from browsing and checkout while preserving the product, delivery inventory, orders, and transaction history."}
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-md border border-border p-3 text-sm">{archiveTarget?.title}</p>
          {!archiveTarget?.archived_at && (
            <p className="text-sm text-muted-foreground">
              Existing linked orders: {archiveTarget?.order_count ?? 0}. Order details and delivered
              records are retained.
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={archiveBusy}
              onClick={() => setArchiveTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={archiveTarget?.archived_at ? "default" : "destructive"}
              disabled={archiveBusy}
              onClick={() => void confirmArchive()}
            >
              {archiveBusy ? "Saving…" : archiveTarget?.archived_at ? "Restore" : "Archive product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(activityProduct)}
        onOpenChange={(open) => {
          if (!open) setActivityProduct(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Product Activity Log</DialogTitle>
            <DialogDescription>
              {activityProduct?.title} · Administrative changes only; delivery record contents are
              never logged.
            </DialogDescription>
          </DialogHeader>
          {activityLoading ? (
            <p className="py-5 text-sm text-muted-foreground" role="status">
              Loading activity…
            </p>
          ) : activity.length ? (
            <ol className="space-y-3">
              {activity.map((entry) => (
                <li key={entry.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <strong>
                      {entry.action.replace("admin.product.", "").replaceAll("_", " ")}
                    </strong>
                    <time className="text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString()}
                    </time>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Administrator: {entry.actor_id ?? "Unavailable"}
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap break-words text-xs">
                    {JSON.stringify(entry.metadata, null, 2)}
                  </pre>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-5 text-sm text-muted-foreground">
              No product activity has been recorded.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(inventoryProduct)}
        onOpenChange={(open) => {
          if (!open && !inventoryBusy) {
            setInventoryProduct(null);
            setInventoryCount(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add secure delivery inventory</DialogTitle>
            <DialogDescription>
              Each record is stored in the protected delivery table and revealed only to its
              purchaser. Its contents are not returned to the dashboard or included in activity
              logs.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            <strong>{inventoryProduct?.title}</strong> · Sellable stock:{" "}
            {inventoryProduct?.stock ?? "—"} · Available delivery records:{" "}
            {inventoryCount ?? "checking…"}
          </p>
          <label className="text-sm">
            One delivery record
            <textarea
              className="mt-1 min-h-32 w-full rounded-md border border-input bg-background p-3"
              maxLength={10000}
              value={inventoryContent}
              onChange={(event) => {
                setInventoryContent(event.target.value);
                setInventoryReference(null);
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={inventoryBusy}
              onClick={() => setInventoryProduct(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={inventoryBusy || !inventoryContent.trim() || inventoryCount === null}
              onClick={() => setInventoryConfirmationOpen(true)}
            >
              Review secure record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={inventoryConfirmationOpen}
        onOpenChange={(open) => {
          if (!inventoryBusy) setInventoryConfirmationOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm delivery inventory</DialogTitle>
            <DialogDescription>
              Add one protected delivery record for {inventoryProduct?.title}. Stock increases by
              one. The value is not written to the audit log.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-md border border-border p-3 text-sm">
            Confirm that the record entered in the previous dialog is correct. It will not be
            displayed here.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={inventoryBusy}
              onClick={() => setInventoryConfirmationOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={inventoryBusy}
              onClick={() => void confirmAddInventory()}
            >
              {inventoryBusy ? "Saving securely…" : "Add record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
