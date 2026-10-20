import { describe, expect, it } from "vitest";
import {
  inventoryDuplicateKey,
  inventoryEntryError,
  parseBulkInventory,
} from "@/lib/admin-inventory";

describe("admin bulk inventory parsing", () => {
  it("parses labeled records and retains custom fields and punctuation", () => {
    const parsed = parseBulkInventory(
      "ID: user:123 | Password: pass|word! | Region: West Africa\nUsername: second | Password: secret | Instructions: Keep line 1",
    );

    expect(parsed.detectedCount).toBe(2);
    expect(parsed.entries[0]).toMatchObject({
      username: "user:123",
      password: "pass|word!",
      specifications: "region: West Africa",
    });
    expect(parsed.entries[1]).toMatchObject({
      username: "second",
      password: "secret",
      deliveryInstructions: "Keep line 1",
    });
    expect(parsed.entries[0]?.sourceLine).toContain("ID: user:123");
  });

  it("retains malformed rows so required fields can be corrected", () => {
    const parsed = parseBulkInventory("not a labeled record\nID: only-id");

    expect(parsed.detectedCount).toBe(2);
    expect(parsed.entries[0]?.sourceLine).toBe("not a labeled record");
    expect(inventoryEntryError(parsed.entries[0]!)).toBe("ID or username is required.");
    expect(inventoryEntryError(parsed.entries[1]!)).toBe("Password is required.");
  });

  it("detects all twenty records in a pasted batch", () => {
    const records = Array.from(
      { length: 20 },
      (_, index) => `ID: account-${index} | Password: password-${index}`,
    ).join("\n");

    expect(parseBulkInventory(records).detectedCount).toBe(20);
  });

  it("detects duplicates even when custom fields are ordered differently", () => {
    const first = {
      key: "first",
      username: "account",
      password: "secret",
      specifications: "Region: West\nTier: Gold",
      deliveryInstructions: "",
    };
    const second = {
      ...first,
      key: "second",
      specifications: "Tier: Gold\nRegion: West",
    };

    expect(inventoryDuplicateKey(first)).toBe(inventoryDuplicateKey(second));
  });
});
