import { SANDBOX_STRATEGIES_API } from "../config/sandboxConfig";
import type { JsonScalar, NodeIoCatalog, NodeRuntimeResult } from "../components/nodes/NodeTypes";

const API_URL = import.meta.env.VITE_API_URL;

type ApiErrorPayload = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
};

export type ApiError = {
  code: string;
  message: string;
  details: string[];
};

export type StrategyTestResults = Record<string, NodeRuntimeResult>;

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  return res.json();
}

export async function fetchNodeIoCatalog(signal?: AbortSignal): Promise<NodeIoCatalog> {
  const response = await fetch(SANDBOX_STRATEGIES_API.nodeIoUrl, {
    method: "GET",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch node catalog (${response.status})`);
  }

  const payload = (await response.json()) as unknown;
  if (!isNodeIoCatalog(payload)) {
    throw new Error("Malformed node catalog payload.");
  }
  return payload;
}

export async function testStrategy(
  payload: unknown,
  signal?: AbortSignal
): Promise<StrategyTestResults> {
  const response = await fetch(SANDBOX_STRATEGIES_API.testStrategyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  const json = (await response.json()) as unknown;
  if (!isStrategyTestResults(json)) {
    throw new Error("Malformed strategy test response.");
  }
  return json;
}

async function toApiError(response: Response): Promise<ApiError> {
  const fallbackMessage = `Request failed (${response.status})`;

  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return {
      code: typeof payload.code === "string" && payload.code.length > 0 ? payload.code : "request_failed",
      message:
        typeof payload.message === "string" && payload.message.length > 0
          ? payload.message
          : fallbackMessage,
      details: Array.isArray(payload.details)
        ? payload.details.flatMap((detail) => (typeof detail === "string" ? [detail] : []))
        : [],
    };
  } catch {
    return {
      code: "request_failed",
      message: fallbackMessage,
      details: [],
    };
  }
}

function isNodeIoCatalog(payload: unknown): payload is NodeIoCatalog {
  if (!isRecord(payload)) return false;
  if (!Array.isArray(payload.nodes)) return false;

  return payload.nodes.every((node) => {
    if (!isRecord(node)) return false;
    if (typeof node.nodeType !== "string") return false;
    if (typeof node.nodeClass !== "string") return false;
    if (!Array.isArray(node.inputs) || !Array.isArray(node.outputs) || !Array.isArray(node.dataFields)) {
      return false;
    }

    return (
      [...node.inputs, ...node.outputs].every((port) => {
        if (!isRecord(port)) return false;
        return (
          typeof port.index === "number" &&
          typeof port.name === "string" &&
          typeof port.arity === "string" &&
          typeof port.valueType === "string" &&
          typeof port.valueTypeClass === "string"
        );
      }) &&
      node.dataFields.every((field) => {
        if (!isRecord(field)) return false;
        const { defaultValue } = field;
        return (
          typeof field.name === "string" &&
          typeof field.valueType === "string" &&
          typeof field.valueTypeClass === "string" &&
          typeof field.required === "boolean" &&
          (defaultValue === undefined || isJsonScalar(defaultValue))
        );
      })
    );
  });
}

function isStrategyTestResults(payload: unknown): payload is StrategyTestResults {
  if (!isRecord(payload)) return false;

  return Object.values(payload).every((nodeResult) => {
    if (!isRecord(nodeResult)) return false;
    return Object.values(nodeResult).every((value) => isJsonScalar(value));
  });
}

function isJsonScalar(value: unknown): value is JsonScalar {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
