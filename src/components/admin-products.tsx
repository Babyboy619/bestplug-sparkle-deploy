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
  adminArchiveProduct,
  adminProductActivity,
  adminProductInventorySummary,
  adminListAvailableInventory,
  adminSaveProduct,
  adminUpdateAvailableInventory,
  adminSearchProducts,
} from "@/lib/admin.functions";
import {
  emptyInventoryDraft,
  inventoryDuplicateKey,
  inventoryEntryError,
  inventoryEntryPayload,
  parseBulkInventory,
  type InventoryDraft,
} from "@/lib/admin-inventory";

type ProductResult = Awaited<ReturnType<typeof adminSearchProducts>>;
type AdminProduct = NonNullable<ProductResult["products"]>[number];
type ActivityResult = Awaited<ReturnType<typeof adminProductActivity>>;
type AvailableInventoryResult = Awaited<ReturnType<typeof adminListAvailableInventory>>;
type ManagedInventoryEntry = InventoryDraft & { credentialId: string; content: string };
type ProductStatus = "draft" | "published" | "unavailable";

type ProductForm = {
  id: string | null;
  title: string;
  categoryId: string;
  description: string;
  price: string;
  status: ProductStatus;
  specifications: string;
  deliveryInstructions: string;
  inventory: InventoryDraft[];
};

const emptyForm: ProductForm = {
  id: null,
  title: "",
  categoryId: "",
  description: "",
  price: "",
  status: "draft",
  specifications: "",
  deliveryInstructions: "",
  inventory: [],
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
  const loadInventorySummary = useServerFn(adminProductInventorySummary);
  const loadAvailableInventory = useServerFn(adminListAvailableInventory);
  const updateAvailableInventory = useServerFn(adminUpdateAvailableInventory);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | ProductStatus | "archived">("all");
  const [categoryId, setCategoryId] = useState("all");
  const [page, setPage] = useState(1);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [result, setResult] = useState<ProductResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm | null>(null);
  const [formReference, setFormReference] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [bulkEntries, setBulkEntries] = useState<InventoryDraft[]>([]);
  const [archiveTarget, setArchiveTarget] = useState<AdminProduct | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [activityProduct, setActivityProduct] = useState<AdminProduct | null>(null);
  const [activity, setActivity] = useState<ActivityResult>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [inventorySummary, setInventorySummary] = useState<{
    total: number;
    available: number;
    sold: number;
    reserved: number;
    newlyAdded: number;
  } | null>(null);
  const [availableInventory, setAvailableInventory] = useState<ManagedInventoryEntry[]>([]);
  const [availableInventoryLoading, setAvailableInventoryLoading] = useState(false);
  const [inventorySaveId, setInventorySaveId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!form?.id) {
      setInventorySummary(null);
      setAvailableInventory([]);
      setAvailableInventoryLoading(false);
      return;
    }
    let active = true;
    setInventorySummary(null);
    setAvailableInventory([]);
    setAvailableInventoryLoading(true);
    void loadInventorySummary({ data: { productId: form.id } })
      .then((summary) => {
        if (active) setInventorySummary(summary);
      })
      .catch((cause: unknown) => {
        if (active)
          toast.error(cause instanceof Error ? cause.message : "Inventory summary is unavailable.");
      });
    void loadAvailableInventory({ data: { productId: form.id } })
      .then((entries: AvailableInventoryResult) => {
        if (!active) return;
        setAvailableInventory(
          entries.map((entry) => ({
            key: entry.id,
            credentialId: entry.id,
            content: entry.content,
            username: entry.username ?? "",
            password: entry.password ?? "",
            specifications:
              typeof entry.specifications === "object" &&
              entry.specifications !== null &&
              !Array.isArray(entry.specifications)
                ? Object.entries(entry.specifications)
                    .map(([key, value]) => `${key}: ${String(value)}`)
                    .join("\n")
                : "",
            deliveryInstructions: entry.delivery_instructions ?? "",
          })),
        );
      })
      .catch((cause: unknown) => {
        if (active)
          toast.error(
            cause instanceof Error ? cause.message : "Available inventory is unavailable.",
          );
      })
      .finally(() => {
        if (active) setAvailableInventoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [form?.id, loadAvailableInventory, loadInventorySummary]);

  const pageCount = Math.max(1, Math.ceil((result?.total ?? 0) / 20));

  function editProduct(product: AdminProduct) {
    const metadata = productMetadata(product);
    setForm({
      id: product.id,
      title: product.title,
      categoryId: product.category_id ?? "",
      description: product.description ?? "",
      price: String(product.price),
      status: product.product_status,
      specifications: Object.entries(metadata.specifications)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n"),
      deliveryInstructions: metadata.deliveryInstructions,
      inventory: [],
    });
    setFormReference(crypto.randomUUID());
    setBulkText("");
    setBulkEntries([]);
    setFormError(null);
  }

  async function saveAvailableEntry(entry: ManagedInventoryEntry) {
    const validationError = inventoryEntryError(entry);
    if (validationError) {
      setFormError(`Available inventory: ${validationError}`);
      return;
    }
    setInventorySaveId(entry.credentialId);
    setFormError(null);
    try {
      await updateAvailableInventory({
        data: { credentialId: entry.credentialId, ...inventoryEntryPayload(entry) },
      });
      toast.success("Available inventory entry updated.");
      setRefreshIndex((value) => value + 1);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Inventory entry could not be updated.");
    } finally {
      setInventorySaveId(null);
    }
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
    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      Math.abs(price * 100 - Math.round(price * 100)) >= 1e-7
    ) {
      setFormError("Enter a positive NGN price with at most two decimal places.");
      return;
    }
    if (!formReference) {
      setFormError("The save request could not be prepared. Close and reopen the product form.");
      return;
    }
    const entries = [...form.inventory, ...bulkEntries];
    const seen = new Set(
      availableInventory.filter((entry) => !inventoryEntryError(entry)).map(inventoryDuplicateKey),
    );
    for (const [index, entry] of entries.entries()) {
      const entryError = inventoryEntryError(entry);
      if (entryError) {
        setFormError(`Inventory record ${index + 1}: ${entryError}`);
        return;
      }
      const duplicateKey = inventoryDuplicateKey(entry);
      if (seen.has(duplicateKey)) {
        setFormError(`Inventory record ${index + 1} duplicates an existing or submitted record.`);
        return;
      }
      seen.add(duplicateKey);
    }
    setFormBusy(true);
    setFormError(null);
    try {
      const saved = await saveProduct({
        data: {
          reference: formReference,
          id: form.id,
          title: form.title,
          categoryId: form.categoryId || null,
          description: form.description,
          price,
          status: form.status,
          specifications: specs,
          deliveryInstructions: form.deliveryInstructions,
          inventory: entries.map(inventoryEntryPayload),
        },
      });
      toast.success(
        `${form.id ? "Product updated" : "Product created"}. ${saved.savedCount} inventory ${saved.savedCount === 1 ? "entry" : "entries"} saved successfully. Available stock: ${saved.stock}.`,
      );
      setForm(null);
      setFormReference(null);
      setBulkEntries([]);
      setBulkText("");
      setRefreshIndex((value) => value + 1);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Product could not be saved.";
      setFormError(
        message.includes("A published product needs available delivery inventory")
          ? "A product can be published only after adding at least one available delivery record."
          : message,
      );
    } finally {
      setFormBusy(false);
    }
  }

  const previewValidCount = (() => {
    const seen = new Set(
      availableInventory.filter((entry) => !inventoryEntryError(entry)).map(inventoryDuplicateKey),
    );
    let count = 0;
    for (const entry of [...(form?.inventory ?? []), ...bulkEntries]) {
      if (inventoryEntryError(entry)) continue;
      const key = inventoryDuplicateKey(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      if (bulkEntries.some((bulkEntry) => bulkEntry.key === entry.key)) count += 1;
    }
    return count;
  })();

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
            setFormReference(crypto.randomUUID());
            setBulkText("");
            setBulkEntries([]);
            setInventorySummary(null);
            setAvailableInventory([]);
            setAvailableInventoryLoading(false);
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
          <div className="mt-5 rounded-lg border border-border">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 font-semibold">Product</th>
                  <th className="hidden p-3 font-semibold sm:table-cell">Category</th>
                  <th className="p-3 font-semibold">Price</th>
                  <th className="p-3 font-semibold">Stock</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="hidden p-3 font-semibold md:table-cell">Created</th>
                  <th className="p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.products.map((product) => (
                  <tr key={product.id} className="border-t border-border">
                    <td className="break-words p-3">
                      <p className="font-medium">{product.title}</p>
                      <p className="mt-1 hidden break-all text-xs text-muted-foreground sm:block">
                        {product.slug}
                      </p>
                    </td>
                    <td className="hidden break-words p-3 sm:table-cell">
                      {product.product_categories?.name ?? "Uncategorized"}
                    </td>
                    <td className="p-3">{money(Number(product.price))}</td>
                    <td className="p-3">{product.stock}</td>
                    <td className="p-3 capitalize">
                      {product.archived_at ? "Archived" : product.product_status}
                    </td>
                    <td className="hidden p-3 md:table-cell">
                      {new Date(product.created_at).toLocaleDateString()}
                    </td>
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
                              onClick={() => editProduct(product)}
                            >
                              Add inventory
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
              Product details are saved to the marketplace database.
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
              </div>
              <div className="rounded-md border border-border p-3">
                <h3 className="text-sm font-semibold">Inventory summary</h3>
                {form.id ? (
                  inventorySummary ? (
                    <dl className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div>
                        <dt className="text-muted-foreground">Total</dt>
                        <dd>{inventorySummary.total}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Available</dt>
                        <dd>{inventorySummary.available}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Sold</dt>
                        <dd>{inventorySummary.sold}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Reserved</dt>
                        <dd>{inventorySummary.reserved}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">New, 24h</dt>
                        <dd>{inventorySummary.newlyAdded}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground" role="status">
                      Loading inventory…
                    </p>
                  )
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">No inventory saved yet.</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Available stock is calculated from unassigned, unreserved delivery entries. New
                  entries in this form: {form.inventory.length + bulkEntries.length}.
                </p>
              </div>
              {form.id && (
                <section
                  aria-labelledby="available-inventory-heading"
                  className="space-y-3 border-t border-border pt-4"
                >
                  <h3 id="available-inventory-heading" className="text-base font-semibold">
                    Available inventory
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Only unsold, unreserved entries are listed here. Sold and reserved credentials
                    cannot be edited.
                  </p>
                  {availableInventoryLoading ? (
                    <p className="text-sm text-muted-foreground" role="status">
                      Loading available entries…
                    </p>
                  ) : availableInventory.length ? (
                    availableInventory.map((entry, index) => (
                      <fieldset
                        key={entry.credentialId}
                        className="space-y-3 rounded-md border border-border p-3"
                      >
                        <legend className="px-1 text-sm font-semibold">
                          Available entry {index + 1}
                        </legend>
                        {(!entry.username || !entry.password) && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Existing delivery payload
                            </p>
                            <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded border border-border p-2 text-xs">
                              {entry.content}
                            </pre>
                          </div>
                        )}
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="text-sm">
                            ID or username
                            <Input
                              className="mt-1"
                              value={entry.username}
                              autoComplete="off"
                              onChange={(event) =>
                                setAvailableInventory(
                                  availableInventory.map((item) =>
                                    item.credentialId === entry.credentialId
                                      ? { ...item, username: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </label>
                          <label className="text-sm">
                            Password
                            <textarea
                              className="mt-1 min-h-10 w-full rounded-md border border-input bg-background p-3"
                              autoComplete="off"
                              spellCheck={false}
                              value={entry.password}
                              onChange={(event) =>
                                setAvailableInventory(
                                  availableInventory.map((item) =>
                                    item.credentialId === entry.credentialId
                                      ? { ...item, password: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </label>
                        </div>
                        <label className="block text-sm">
                          Additional specifications
                          <textarea
                            className="mt-1 min-h-16 w-full rounded-md border border-input bg-background p-3"
                            value={entry.specifications}
                            onChange={(event) =>
                              setAvailableInventory(
                                availableInventory.map((item) =>
                                  item.credentialId === entry.credentialId
                                    ? { ...item, specifications: event.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                        </label>
                        <label className="block text-sm">
                          Delivery instructions
                          <textarea
                            className="mt-1 min-h-16 w-full rounded-md border border-input bg-background p-3"
                            value={entry.deliveryInstructions}
                            onChange={(event) =>
                              setAvailableInventory(
                                availableInventory.map((item) =>
                                  item.credentialId === entry.credentialId
                                    ? { ...item, deliveryInstructions: event.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                        </label>
                        {inventoryEntryError(entry) && (
                          <p className="text-sm text-destructive" role="alert">
                            {inventoryEntryError(entry)}
                          </p>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={inventorySaveId !== null}
                          onClick={() => void saveAvailableEntry(entry)}
                        >
                          {inventorySaveId === entry.credentialId
                            ? "Saving…"
                            : "Save inventory entry"}
                        </Button>
                      </fieldset>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No available entries to manage.</p>
                  )}
                </section>
              )}
              <section
                aria-labelledby="delivery-inventory-heading"
                className="space-y-4 border-t border-border pt-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 id="delivery-inventory-heading" className="text-base font-semibold">
                    Delivery Inventory / Product Logs
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setForm({ ...form, inventory: [...form.inventory, emptyInventoryDraft()] })
                    }
                  >
                    Add Another Log
                  </Button>
                </div>
                {form.inventory.map((entry, index) => (
                  <fieldset
                    key={entry.key}
                    className="space-y-3 rounded-md border border-border p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <legend className="text-sm font-semibold">Log {index + 1}</legend>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setForm({
                            ...form,
                            inventory: form.inventory.filter((item) => item.key !== entry.key),
                          })
                        }
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm">
                        ID or username
                        <Input
                          className="mt-1"
                          value={entry.username}
                          autoComplete="off"
                          onChange={(event) =>
                            setForm({
                              ...form,
                              inventory: form.inventory.map((item) =>
                                item.key === entry.key
                                  ? { ...item, username: event.target.value }
                                  : item,
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="text-sm">
                        Password
                        <textarea
                          className="mt-1 min-h-10 w-full rounded-md border border-input bg-background p-3"
                          autoComplete="off"
                          spellCheck={false}
                          value={entry.password}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              inventory: form.inventory.map((item) =>
                                item.key === entry.key
                                  ? { ...item, password: event.target.value }
                                  : item,
                              ),
                            })
                          }
                        />
                      </label>
                    </div>
                    <label className="block text-sm">
                      Additional specifications
                      <textarea
                        className="mt-1 min-h-20 w-full rounded-md border border-input bg-background p-3"
                        placeholder="Region: Nigeria"
                        value={entry.specifications}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            inventory: form.inventory.map((item) =>
                              item.key === entry.key
                                ? { ...item, specifications: event.target.value }
                                : item,
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="block text-sm">
                      Delivery instructions
                      <textarea
                        className="mt-1 min-h-20 w-full rounded-md border border-input bg-background p-3"
                        value={entry.deliveryInstructions}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            inventory: form.inventory.map((item) =>
                              item.key === entry.key
                                ? { ...item, deliveryInstructions: event.target.value }
                                : item,
                            ),
                          })
                        }
                      />
                    </label>
                    {inventoryEntryError(entry) && (
                      <p className="text-sm text-destructive" role="alert">
                        {inventoryEntryError(entry)}
                      </p>
                    )}
                  </fieldset>
                ))}
              </section>
              <section
                aria-labelledby="bulk-logs-heading"
                className="space-y-3 border-t border-border pt-4"
              >
                <h3 id="bulk-logs-heading" className="text-base font-semibold">
                  Bulk Add Logs
                </h3>
                <label className="block text-sm">
                  Upload log files (.txt)
                  <Input
                    type="file"
                    accept=".txt,text/plain"
                    multiple
                    disabled={formBusy}
                    className="mt-1"
                    onChange={async (event) => {
                      const files = Array.from(event.target.files ?? []);
                      event.target.value = "";
                      if (!files.length) return;
                      if (files.some((file) => !file.name.toLowerCase().endsWith(".txt") || file.size > 1000000)) {
                        setFormError("Choose text log files smaller than 1 MB each.");
                        return;
                      }
                      try {
                        const text = (await Promise.all(files.map((file) => file.text()))).join("\n");
                        const imported = parseBulkInventory(text).entries;
                        if (imported.length + bulkEntries.length + form.inventory.length > 1000) {
                          setFormError("Save up to 1,000 logs per batch.");
                          return;
                        }
                        setBulkEntries((entries) => [...entries, ...imported]);
                        setFormError(null);
                      } catch {
                        setFormError("The log files could not be read. Please try again.");
                      }
                    }}
                  />
                </label>
                <label className="block text-sm">
                  Paste one record per line, using ID: value | Password: value | Custom field: value
                  <textarea
                    className="mt-1 min-h-28 w-full rounded-md border border-input bg-background p-3 font-mono text-sm"
                    value={bulkText}
                    onChange={(event) => setBulkText(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!bulkText.trim()}
                    onClick={() => setBulkEntries(parseBulkInventory(bulkText).entries)}
                  >
                    Preview records
                  </Button>
                  {bulkEntries.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setBulkEntries([]);
                        setBulkText("");
                      }}
                    >
                      Cancel import
                    </Button>
                  )}
                </div>
                {bulkEntries.length > 0 && (
                  <div className="space-y-3" aria-live="polite">
                    <p className="text-sm">
                      {bulkEntries.length} records detected · {previewValidCount} valid records ·{" "}
                      {bulkEntries.length - previewValidCount} need correction or are duplicates
                    </p>
                    {bulkEntries.map((entry, index) => {
                      const priorEntries = [...form.inventory, ...bulkEntries.slice(0, index)];
                      const duplicate =
                        !inventoryEntryError(entry) &&
                        (availableInventory.some(
                          (prior) => inventoryDuplicateKey(prior) === inventoryDuplicateKey(entry),
                        ) ||
                          priorEntries.some(
                            (prior) =>
                              inventoryDuplicateKey(prior) === inventoryDuplicateKey(entry),
                          ));
                      const rowError =
                        inventoryEntryError(entry) ??
                        (duplicate ? "Duplicate record detected." : null);
                      return (
                        <fieldset
                          key={entry.key}
                          className="space-y-3 rounded-md border border-border p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <legend className="text-sm font-semibold">
                              Imported record {index + 1}
                            </legend>
                            <span
                              className={
                                rowError
                                  ? "text-sm text-destructive"
                                  : "text-sm text-muted-foreground"
                              }
                            >
                              {rowError ?? "Valid"}
                            </span>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="text-sm">
                              ID or username
                              <Input
                                className="mt-1"
                                value={entry.username}
                                autoComplete="off"
                                onChange={(event) =>
                                  setBulkEntries(
                                    bulkEntries.map((item) =>
                                      item.key === entry.key
                                        ? { ...item, username: event.target.value }
                                        : item,
                                    ),
                                  )
                                }
                              />
                            </label>
                            <label className="text-sm">
                              Password
                              <textarea
                                className="mt-1 min-h-10 w-full rounded-md border border-input bg-background p-3"
                                autoComplete="off"
                                spellCheck={false}
                                value={entry.password}
                                onChange={(event) =>
                                  setBulkEntries(
                                    bulkEntries.map((item) =>
                                      item.key === entry.key
                                        ? { ...item, password: event.target.value }
                                        : item,
                                    ),
                                  )
                                }
                              />
                            </label>
                          </div>
                          <label className="block text-sm">
                            Additional specifications
                            <textarea
                              className="mt-1 min-h-16 w-full rounded-md border border-input bg-background p-3"
                              value={entry.specifications}
                              onChange={(event) =>
                                setBulkEntries(
                                  bulkEntries.map((item) =>
                                    item.key === entry.key
                                      ? { ...item, specifications: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </label>
                          <label className="block text-sm">
                            Delivery instructions
                            <textarea
                              className="mt-1 min-h-16 w-full rounded-md border border-input bg-background p-3"
                              value={entry.deliveryInstructions}
                              onChange={(event) =>
                                setBulkEntries(
                                  bulkEntries.map((item) =>
                                    item.key === entry.key
                                      ? { ...item, deliveryInstructions: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </label>
                        </fieldset>
                      );
                    })}
                  </div>
                )}
              </section>
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
                <Button type="submit" disabled={formBusy || inventorySaveId !== null}>
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
    </section>
  );
}
