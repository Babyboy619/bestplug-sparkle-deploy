import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminProducts } from "@/components/admin-products";

const product = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Starter account",
  slug: "starter-account",
  category_id: null,
  description: null,
  price: 2500,
  currency: "NGN",
  stock: 1,
  published: false,
  product_status: "draft" as const,
  metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  archived_at: null,
  product_categories: null,
  order_count: 0,
};

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  save: vi.fn(),
  inventoryCount: vi.fn(),
  addInventory: vi.fn(),
  archive: vi.fn(),
  activity: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({ useServerFn: (serverFn: unknown) => serverFn }));

vi.mock("@/lib/admin.functions", () => ({
  adminAddProductInventory: mocks.addInventory,
  adminArchiveProduct: mocks.archive,
  adminProductActivity: mocks.activity,
  adminProductInventoryCount: mocks.inventoryCount,
  adminSaveProduct: mocks.save,
  adminSearchProducts: mocks.search,
}));

function result(products: (typeof product)[] = []) {
  return { products, categories: [], total: products.length, page: 1, pageSize: 20 };
}

describe("admin product editing", () => {
  beforeEach(() => {
    mocks.search.mockReset().mockResolvedValue(result([product]));
    mocks.save.mockReset().mockResolvedValue({ id: product.id });
    mocks.inventoryCount.mockReset().mockResolvedValue(1);
    mocks.addInventory.mockReset().mockResolvedValue({ stock: 2 });
    mocks.archive.mockReset();
    mocks.activity.mockReset();
  });

  it("saves product fields without an image URL", async () => {
    render(<AdminProducts />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    expect(screen.queryByLabelText("Product image URL")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Product name"), {
      target: { value: "Starter account updated" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save product" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save.mock.calls[0]?.[0]).toEqual({
      data: {
        id: product.id,
        title: "Starter account updated",
        categoryId: null,
        description: "",
        price: 2500,
        stock: 1,
        status: "draft",
        specifications: {},
        deliveryInstructions: "",
      },
    });
  });

  it("adds secure inventory to resolve stock validation and updates the edit form", async () => {
    mocks.save
      .mockRejectedValueOnce(new Error("Add delivery inventory before increasing sellable stock"))
      .mockResolvedValueOnce({ id: product.id });
    render(<AdminProducts />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Sellable stock"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save product" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sellable stock must be backed by available delivery records.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Manage delivery inventory" }));
    fireEvent.change(await screen.findByLabelText("One delivery record"), {
      target: { value: "secure-delivery-payload" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review secure record" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add record" }));
    await waitFor(() => expect(mocks.addInventory).toHaveBeenCalledTimes(1));
    expect(mocks.addInventory.mock.calls[0]?.[0]).toMatchObject({
      data: { productId: product.id, content: "secure-delivery-payload" },
    });

    fireEvent.click(await screen.findByRole("button", { name: "Return to product form" }));
    expect(await screen.findByLabelText("Sellable stock")).toHaveValue(2);
    fireEvent.click(screen.getByRole("button", { name: "Save product" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
    expect(mocks.save.mock.calls[1]?.[0]).toMatchObject({ data: { stock: 2 } });
  });
});
