import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const displayNameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(80, "Name must be 80 characters or fewer."),
});

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254),
});

export const saveProfileName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => displayNameSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ display_name: data.displayName })
      .eq("id", context.userId);
    if (error) throw new Error("Profile name could not be saved.");
    return { displayName: data.displayName };
  });

export const validateAccountEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => emailSchema.parse(input))
  .handler(({ data }) => ({ email: data.email.toLowerCase() }));
