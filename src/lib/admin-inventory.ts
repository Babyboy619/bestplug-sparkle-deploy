export type InventoryDraft = {
  key: string;
  username: string;
  password: string;
  specifications: string;
  deliveryInstructions: string;
  sourceLine?: string;
};

export type ParsedInventory = {
  entries: InventoryDraft[];
  detectedCount: number;
};

export function emptyInventoryDraft(): InventoryDraft {
  return {
    key: crypto.randomUUID(),
    username: "",
    password: "",
    specifications: "",
    deliveryInstructions: "",
  };
}

function parseSpecifications(value: string): Record<string, string> | null {
  const specifications: Record<string, string> = {};
  for (const line of value.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const separator = line.indexOf(":");
    if (separator <= 0) return null;
    const key = line.slice(0, separator).trim();
    const content = line.slice(separator + 1).trim();
    if (
      !key ||
      !content ||
      key.length > 100 ||
      content.length > 500 ||
      Object.hasOwn(specifications, key)
    )
      return null;
    specifications[key] = content;
  }
  return Object.keys(specifications).length <= 20 ? specifications : null;
}

export function inventoryEntryError(entry: InventoryDraft): string | null {
  if (!entry.username.trim()) return "ID or username is required.";
  if (!entry.password.trim()) return "Password is required.";
  if (entry.username.length > 1000 || entry.password.length > 5000) {
    return "ID/username or password is too long.";
  }
  if (entry.deliveryInstructions.length > 5000) return "Delivery instructions are too long.";
  const specifications = parseSpecifications(entry.specifications);
  if (entry.specifications.length > 10000 || !specifications) {
    return "Enter custom specifications one per line as Name: value (up to 20 fields).";
  }
  const contentLength = [
    `ID: ${entry.username.trim()}`,
    `Password: ${entry.password}`,
    ...Object.entries(specifications).map(([key, value]) => `${key}: ${value}`),
    entry.deliveryInstructions ? `Instructions: ${entry.deliveryInstructions}` : "",
  ]
    .filter(Boolean)
    .join("\n").length;
  if (contentLength > 10000)
    return "The complete delivery record must be 10000 characters or fewer.";
  return null;
}

export function inventoryDuplicateKey(entry: InventoryDraft): string {
  const specifications = parseSpecifications(entry.specifications);
  return JSON.stringify([
    entry.username.trim(),
    entry.password,
    specifications &&
      Object.fromEntries(
        Object.entries(specifications).sort(([left], [right]) => left.localeCompare(right)),
      ),
    entry.deliveryInstructions,
  ]);
}

export function parseBulkInventory(text: string): ParsedInventory {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const entries = lines.map((sourceLine): InventoryDraft => {
    const fields = new Map<string, string>();
    const parts = sourceLine.split(
      /\s*\|\s*(?=(?:ID|Username|Password|Instructions|[A-Za-z][A-Za-z0-9 _-]{0,99}):)/i,
    );
    for (const part of parts) {
      const separator = part.indexOf(":");
      if (separator <= 0) continue;
      const name = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      if (name) fields.set(name.toLowerCase(), value);
    }
    const username = fields.get("id") ?? fields.get("username") ?? "";
    const password = fields.get("password") ?? "";
    const deliveryInstructions = fields.get("instructions") ?? "";
    const specifications = [...fields.entries()]
      .filter(([name]) => !["id", "username", "password", "instructions"].includes(name))
      .map(([name, value]) => `${name}: ${value}`)
      .join("\n");
    return {
      key: crypto.randomUUID(),
      username,
      password,
      specifications,
      deliveryInstructions,
      sourceLine,
    };
  });
  return { entries, detectedCount: entries.length };
}

export function inventoryEntryPayload(entry: InventoryDraft) {
  const specifications = parseSpecifications(entry.specifications);
  if (!specifications) throw new Error("Inventory specifications are invalid.");
  return {
    username: entry.username.trim(),
    password: entry.password,
    specifications,
    deliveryInstructions: entry.deliveryInstructions,
  };
}
