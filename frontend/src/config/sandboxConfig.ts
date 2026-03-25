export const SANDBOX_NODE_WIDTH = 240;
export const SANDBOX_LIBRARY_NODE_WIDTH = 180;
export const SANDBOX_NOTIFICATION_TIMEOUT_MS = 4200;
export const SANDBOX_DEFAULT_UNTITLED_STRATEGY_NAME = "Untitled Strategy";

function resolveSandboxBackendHost() {
  const configuredHost = import.meta.env.VITE_SANDBOX_BACKEND_HOST?.trim();
  if (!configuredHost) {
    throw new Error("VITE_SANDBOX_BACKEND_HOST must be configured for the sandbox frontend.");
  }
  return configuredHost;
}

function resolveSandboxBackendPort() {
  const configuredPort = import.meta.env.VITE_SANDBOX_BACKEND_PORT?.trim();
  if (!configuredPort) {
    throw new Error("VITE_SANDBOX_BACKEND_PORT must be configured for the sandbox frontend.");
  }
  return configuredPort;
}

function resolveSandboxApiBase() {
  const host = resolveSandboxBackendHost();
  const port = resolveSandboxBackendPort();

  if (port === "-1") {
    return host;
  }

  return `${host}:${port}`;
}

const SANDBOX_STRATEGIES_API_BASE = resolveSandboxApiBase();

export const SANDBOX_STRATEGIES_API = {
  baseUrl: SANDBOX_STRATEGIES_API_BASE,
  listStrategiesUrl: `${SANDBOX_STRATEGIES_API_BASE}/api/strategies`,
  strategyByIdUrl: (strategyId: string) =>
    `${SANDBOX_STRATEGIES_API_BASE}/api/strategies/${encodeURIComponent(strategyId)}`,
  nodeIoUrl: `${SANDBOX_STRATEGIES_API_BASE}/api/strategies/node-io`,
  testStrategyUrl: `${SANDBOX_STRATEGIES_API_BASE}/api/strategies/test`,
};
