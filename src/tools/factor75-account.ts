import { Type } from "@sinclair/typebox";
import type { Factor75ClientManager } from "../auth/factor75-client-manager.js";
import { jsonResult, AUTH_REQUIRED } from "./factor75-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFactor75AccountTool(manager: Factor75ClientManager): any {
  return {
    name: "factor75_account",
    label: "Factor75 Account",
    description:
      "Get Factor75 account info — name, email, delivery address, subscription plan, and credits.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "Factor75 account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        // Customer profile: GET /gw/api/customers/me/info
        const info = (await manager.get(account, "api/customers/me/info")) as Record<string, unknown>;

        // Subscription data (includes shipping address)
        const subData = (await manager.get(account, "api/customers/me/subscriptions")) as {
          items?: Array<Record<string, unknown>>;
        };
        const sub = subData.items?.[0];
        const shippingAddress = sub?.shippingAddress as Record<string, unknown> | undefined;
        const region = shippingAddress?.region as Record<string, unknown> | undefined;

        // Subscription summary for plan details
        const subParams = await manager.getSubscriptionParams(account);

        // Credits / wallet: GET /gw/api/customers/me/wallet
        let credits: { amount?: number; currency?: string } | null = null;
        try {
          const wallet = (await manager.get(account, "api/customers/me/wallet")) as {
            balance?: number;
            currency?: string;
          };
          if (wallet.balance !== undefined) {
            credits = { amount: wallet.balance, currency: wallet.currency };
          }
        } catch {
          // non-fatal
        }

        return jsonResult({
          id: info.id ?? info.uuid,
          email: info.email,
          name: [info.firstName, info.lastName].filter(Boolean).join(" "),
          address: shippingAddress
            ? {
                line1: shippingAddress.address1,
                line2: shippingAddress.address2,
                city: shippingAddress.city,
                state: region?.code ?? region?.name,
                zip: shippingAddress.postcode,
              }
            : null,
          subscription: {
            id: subParams.subscriptionId,
            product_sku: subParams.productSku,
            delivery_option: subParams.deliveryOption,
            delivery_day: (sub?.deliveryOption as Record<string, unknown> | undefined)?.deliveryName,
            preference: subParams.preference,
            postcode: subParams.postcode,
            is_active: sub?.isActive ?? false,
          },
          credits,
          boxes_received: info.boxesReceived,
          created_at: info.createdAt,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
