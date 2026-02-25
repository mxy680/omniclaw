import { Type } from "@sinclair/typebox";
import type { IMessageBackend } from "./imessage-backend.js";
import { jsonResult } from "./imessage-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createImessageSendTool(backend: IMessageBackend): any {
  return {
    name: "imessage_send",
    label: "iMessage Send",
    description:
      "Send an iMessage to a phone number or email address. " +
      "Uses either the local Messages app (macOS) or BlueBubbles server depending on configuration.",
    parameters: Type.Object({
      to: Type.String({
        description:
          "Recipient phone number (e.g. '+15551234567') or email address.",
      }),
      text: Type.String({
        description: "The message text to send.",
      }),
    }),
    async execute(
      _toolCallId: string,
      params: { to: string; text: string },
    ) {
      try {
        return jsonResult(await backend.sendMessage(params));
      } catch (err) {
        return jsonResult({
          error: "send_failed",
          message:
            (err instanceof Error ? err.message : String(err)) +
            ". Make sure the Messages app is configured and the recipient is reachable via iMessage.",
        });
      }
    },
  };
}
