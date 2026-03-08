import { Type } from "@sinclair/typebox";
import type { WolframClient } from "../auth/wolfram-client.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("wolfram");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createWolframQueryTool(wolfram: WolframClient): any {
  return {
    name: "wolfram_query",
    label: "Wolfram Alpha Query",
    description:
      "Query Wolfram Alpha using the LLM API. Returns a plain-text answer optimized for LLM consumption. " +
      "Use for math, science, conversions, data lookups, weather, geography, and general computational queries.",
    parameters: Type.Object({
      input: Type.String({ description: "Natural language query (e.g. 'integrate x^2 dx', 'population of France')." }),
      maxchars: Type.Optional(
        Type.Number({ description: "Maximum characters in the response. Default 6800.", default: 6800 }),
      ),
      units: Type.Optional(
        Type.Union([Type.Literal("metric"), Type.Literal("imperial")], {
          description: "Unit system for the response.",
        }),
      ),
      location: Type.Optional(
        Type.String({ description: "Geographic context for location-aware queries (e.g. 'New York, NY')." }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { input: string; maxchars?: number; units?: "metric" | "imperial"; location?: string },
    ) {
      if (!wolfram.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const text = await wolfram.queryLLM(params.input, {
          maxchars: params.maxchars,
          units: params.units,
          location: params.location,
        });
        return jsonResult({ input: params.input, result: text });
      } catch (err: unknown) {
        return jsonResult({
          error: "wolfram_query_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createWolframQueryFullTool(wolfram: WolframClient): any {
  return {
    name: "wolfram_query_full",
    label: "Wolfram Alpha Full Query",
    description:
      "Query Wolfram Alpha using the Full Results API. Returns structured JSON with pods containing detailed results. " +
      "Use when you need granular, structured data — individual pods, images, or specific result categories.",
    parameters: Type.Object({
      input: Type.String({ description: "Natural language query." }),
      format: Type.Optional(
        Type.String({
          description: "Comma-separated output formats: plaintext, image, mathml. Default 'plaintext'.",
          default: "plaintext",
        }),
      ),
      includepodid: Type.Optional(
        Type.String({ description: "Comma-separated pod IDs to include (e.g. 'Result,DecimalApproximation')." }),
      ),
      excludepodid: Type.Optional(
        Type.String({ description: "Comma-separated pod IDs to exclude." }),
      ),
      podindex: Type.Optional(
        Type.String({ description: "Comma-separated pod indices to return (1-based)." }),
      ),
      units: Type.Optional(
        Type.Union([Type.Literal("metric"), Type.Literal("imperial")], {
          description: "Unit system for the response.",
        }),
      ),
      location: Type.Optional(
        Type.String({ description: "Geographic context for location-aware queries." }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        input: string;
        format?: string;
        includepodid?: string;
        excludepodid?: string;
        podindex?: string;
        units?: "metric" | "imperial";
        location?: string;
      },
    ) {
      if (!wolfram.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const data = await wolfram.queryFull(params.input, {
          format: params.format,
          includepodid: params.includepodid,
          excludepodid: params.excludepodid,
          podindex: params.podindex,
          units: params.units,
          location: params.location,
        });
        return jsonResult(data);
      } catch (err: unknown) {
        return jsonResult({
          error: "wolfram_query_full_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
