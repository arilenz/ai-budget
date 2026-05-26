import { createServerFn } from "@tanstack/react-start";
import { createServerApiClient, unwrap } from "#/lib/api-server";

type SyncInput = { accountId: number };

function validateSyncInput(data: unknown): SyncInput {
  if (
    !data ||
    typeof data !== "object" ||
    typeof (data as SyncInput).accountId !== "number"
  ) {
    throw new Error("accountId is required");
  }
  return { accountId: (data as SyncInput).accountId };
}

export const syncMonoAccountFn = createServerFn({ method: "POST" })
  .inputValidator(validateSyncInput)
  .handler(async ({ data }) =>
    unwrap(
      await createServerApiClient().POST("/sync/mono-account/{id}", {
        params: { path: { id: data.accountId } },
      }),
      "Sync failed",
    ),
  );
