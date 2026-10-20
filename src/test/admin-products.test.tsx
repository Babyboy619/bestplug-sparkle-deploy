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
  inventorySummary: vi.fn(),
  listAvailableInventory: vi.fn(),
  updateAvailableInventory: vi.fn(),
  archive: vi.fn(),
  activity: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({ useServerFn: (serverFn: unknown) => serverFn }));

vi.mock("@/lib/admin.functions", () => ({
  adminArchiveProduct: mocks.archive,
  adminProductActivity: mocks.activity,
  adminProductInventorySummary: mocks.inventorySummary,
  adminListAvailableInventory: mocks.listAvailableInventory,
  adminUpdateAvailableInventory: mocks.updateAvailableInventory,
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
    mocks.inventorySummary.mockReset().mockResolvedValue({
      total: 1,
      available: 1,
      sold: 0,
      reserved: 0,
      newlyAdded: 1,
    });
    mocks.listAvailableInventory.mockReset().mockResolvedValue([]);
    mocks.updateAvailableInventory.mockReset().mockResolvedValue({ updated: true });
    mocks.archive.mockReset();
    mocks.activity.mockReset();
  });

  it("saves product fields without an image URL or manual stock", async () => {
    render(<AdminProducts />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    expect(screen.queryByLabelText("Product image URL")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Sellable stock")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Product name"), {
      target: { value: "Starter account updated" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Updated description" },
    });
    fireEvent.change(screen.getByLabelText("Price (NGN)"), {
      target: { value: "2700" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save product" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save.mock.calls[0]?.[0]).toEqual({
      data: {
        reference: expect.any(String),
        id: product.id,
        title: "Starter account updated",
        categoryId: null,
        description: "Updated description",
        price: 2700,
        status: "draft",
        specifications: {},
        deliveryInstructions: "",
        inventory: [],
      },
    });
  });

  it("creates a product with ten inventory entries", async () => {
    mocks.save.mockResolvedValueOnce({ id: product.id, stock: 10, savedCount: 10 });
    render(<AdminProducts />);
    fireEvent.click(screen.getByRole("button", { name: "Create product" }));
    fireEvent.change(screen.getByLabelText("Product name"), {
      target: { value: "Ten-log product" },
    });
    fireEvent.change(screen.getByLabelText("Price (NGN)"), {
      target: { value: "1500" },
    });
    for (let index = 0; index < 10; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Add Another Log" }));
    }
    const usernames = screen.getAllByLabelText("ID or username");
    const passwords = screen.getAllByLabelText("Password");
    for (let index = 0; index < 10; index += 1) {
      fireEvent.change(usernames[index]!, { target: { value: `account-${index}` } });
      fireEvent.change(passwords[index]!, {
        target: { value: index === 0 ? "line1\nline2!" : `special: | value-${index}` },
      });
    }
    fireEvent.click(screen.getByRole("button", { name: "Save product" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    const submitted = mocks.save.mock.calls[0]?.[0].data;
    expect(submitted.id).toBeNull();
    expect(submitted.inventory).toHaveLength(10);
    expect(submitted.inventory[0]).toMatchObject({
      username: "account-0",
      password: "line1\nline2!",
    });
    expect(submitted.inventory[9]).toMatchObject({
      username: "account-9",
      password: "special: | value-9",
    });
    expect(
      screen.queryByText("Add delivery inventory before increasing sellable stock"),
    ).not.toBeInTheDocument();
  });

  it("previews and submits twenty valid bulk records", async () => {
    mocks.save.mockResolvedValueOnce({ id: product.id, stock: 20, savedCount: 20 });
    render(<AdminProducts />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const content = Array.from(
      { length: 20 },
      (_, index) => `ID: account-${index} | Password: pass-${index}`,
    ).join("\n");
    fireEvent.change(screen.getByLabelText(/Paste one record per line/), {
      target: { value: content },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview records" }));
    expect(screen.getByText(/20 records detected · 20 valid records/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save product" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save.mock.calls[0]?.[0].data.inventory).toHaveLength(20);
  });

  it("adds five entries to an existing product without replacing its inventory", async () => {
    mocks.save.mockResolvedValueOnce({ id: product.id, stock: 15, savedCount: 5 });
    render(<AdminProducts />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    for (let index = 0; index < 5; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Add Another Log" }));
    }
    const usernames = screen.getAllByLabelText("ID or username");
    const passwords = screen.getAllByLabelText("Password");
    for (let index = 0; index < 5; index += 1) {
      fireEvent.change(usernames[index]!, { target: { value: `new-account-${index}` } });
      fireEvent.change(passwords[index]!, { target: { value: `new-password-${index}` } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Save product" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save.mock.calls[0]?.[0].data.id).toBe(product.id);
    expect(mocks.save.mock.calls[0]?.[0].data.inventory).toHaveLength(5);
  });

  it("previews malformed bulk rows and allows correcting them before saving", async () => {
    render(<AdminProducts />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/Paste one record per line/), {
      target: { value: "ID: account-1 | Password: pass1\nmalformed row" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview records" }));

    expect(
      screen.getByText(/2 records detected · 1 valid records · 1 need correction/),
    ).toBeInTheDocument();
    const usernames = screen.getAllByLabelText("ID or username");
    const passwords = screen.getAllByLabelText("Password");
    fireEvent.change(usernames[1]!, { target: { value: "account-2" } });
    fireEvent.change(passwords[1]!, { target: { value: "pass2" } });
    expect(
      screen.getByText(/2 records detected · 2 valid records · 0 need correction/),
    ).toBeInTheDocument();
  });
});
