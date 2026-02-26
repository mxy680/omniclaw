import { Type } from "@sinclair/typebox";

type BackgroundSubmitter = {
  submitBackground: (req: {
    task: string;
    reportToConversation?: string;
  }) => Promise<string>;
};

export function createBackgroundWorkerTool(submitter: BackgroundSubmitter) {
  return {
    name: "spawn_background_worker",
    label: "Spawn Background Worker",
    description:
      "Spawn a background task that runs independently of the current conversation. " +
      "The task will be processed when a dispatch slot is available. " +
      "Results are posted back to the originating conversation (or a specified one).",
    parameters: Type.Object({
      task: Type.String({
        description: "Description of what the background worker should do",
      }),
      reportToConversation: Type.Optional(
        Type.String({
          description:
            "Conversation ID to post results to. Defaults to the current conversation.",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { task: string; reportToConversation?: string },
    ) {
      const taskId = await submitter.submitBackground({
        task: params.task,
        reportToConversation: params.reportToConversation,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "started",
              taskId,
              message: `Background task started: ${params.task}`,
            }),
          },
        ],
      };
    },
  };
}
