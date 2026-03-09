import { SANDBOX_STRATEGIES_API } from "../config/sandboxConfig";
import type { NodeIoCatalog } from "../components/nodes/NodeTypes";

const API_URL = import.meta.env.VITE_API_URL;

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password })
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

function isNodeIoCatalog(payload: unknown): payload is NodeIoCatalog {
  if (!isRecord(payload)) return false;
  if (!Array.isArray(payload.nodes)) return false;

  return payload.nodes.every((node) => {
    if (!isRecord(node)) return false;
    if (typeof node.nodeType !== "string") return false;
    if (typeof node.nodeClass !== "string") return false;
    if (!Array.isArray(node.inputs) || !Array.isArray(node.outputs)) return false;

    return [...node.inputs, ...node.outputs].every((port) => {
      if (!isRecord(port)) return false;
      return (
        typeof port.index === "number" &&
        typeof port.name === "string" &&
        typeof port.arity === "string" &&
        typeof port.valueType === "string" &&
        typeof port.valueTypeClass === "string"
      );
    });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
