import type { ComponentType } from "react";
import type { NodeTypes } from "reactflow";
import type { NodeData } from "./base/TwoHandles";
import EPSNode from "./data/EPSNode";
import OutputNode from "./markers/OutputNode";
import StartNode from "./markers/StartNode";

type NodeDefinition = {
  type: string;
  label: string;
  data: NodeData;
};

type NodeComponentWithDefinition = ComponentType<any> & {
  definition: NodeDefinition;
  accent: string;
  color: string;
};

const NODE_DEFINITIONS = [
  StartNode.definition,
  EPSNode.definition,
  OutputNode.definition,
] as const;

const nodeDataByType: Record<string, NodeData> = Object.fromEntries(
  NODE_DEFINITIONS.map((node) => [node.type, node.data])
);
const nodeVisualByType: Record<string, { accent: string; color: string }> = Object.fromEntries(
  ([StartNode, EPSNode, OutputNode] as NodeComponentWithDefinition[]).map((node) => [
    node.definition.type,
    { accent: node.accent, color: node.color },
  ])
);

export const nodePalette = NODE_DEFINITIONS.map((node) => ({
  type: node.type,
  label: node.label,
}));

export function isSupportedNodeType(type: string): boolean {
  return type in nodeDataByType;
}

export function getDefaultNodeData(type: string): NodeData | undefined {
  const data = nodeDataByType[type];
  if (!data) return undefined;

  return {
    ...data,
    extra: data.extra ? { ...data.extra } : undefined,
  };
}

export function getNodeVisual(type: string): { accent: string; color: string } | undefined {
  return nodeVisualByType[type];
}

export const nodeTypes: NodeTypes = Object.fromEntries(
  ([StartNode, EPSNode, OutputNode] as NodeComponentWithDefinition[]).map((node) => [
    node.definition.type,
    node,
  ])
) as NodeTypes;
