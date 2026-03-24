export const SANDBOX_NODE_WIDTH = 240;
export const SANDBOX_LIBRARY_NODE_WIDTH = 180;
export const SANDBOX_NOTIFICATION_TIMEOUT_MS = 4200;
export const SANDBOX_DEFAULT_UNTITLED_STRATEGY_NAME = "Untitled Strategy";

const DEFAULT_SANDBOX_BACKEND_PORT = "9116";

function resolveSandboxBackendPort() {
  const configuredPort = import.meta.env.VITE_SANDBOX_BACKEND_PORT?.trim();
  return configuredPort && configuredPort.length > 0 ? configuredPort : DEFAULT_SANDBOX_BACKEND_PORT;
}

const SANDBOX_STRATEGIES_API_BASE = `http://localhost:${resolveSandboxBackendPort()}`;

export const SANDBOX_STRATEGIES_API = {
  baseUrl: SANDBOX_STRATEGIES_API_BASE,
  listStrategiesUrl: `${SANDBOX_STRATEGIES_API_BASE}/api/strategies`,
  strategyByIdUrl: (strategyId: string) =>
    `${SANDBOX_STRATEGIES_API_BASE}/api/strategies/${encodeURIComponent(strategyId)}`,
  nodeIoUrl: `${SANDBOX_STRATEGIES_API_BASE}/api/strategies/node-io`,
  testStrategyUrl: `${SANDBOX_STRATEGIES_API_BASE}/api/strategies/test`,
};
