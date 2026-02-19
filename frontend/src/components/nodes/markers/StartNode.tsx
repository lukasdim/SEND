import type { JSX } from "react";
import BaseNode, { type NodeData } from "../base/RightHandle";
import type { NodeProps } from "reactflow";

type NodeDefinition = {
  type: string;
  label: string;
  data: NodeData;
};

type NodeComponent = ((props: NodeProps<NodeData>) => JSX.Element) & {
  definition: NodeDefinition;
  accent: string;
  color: string;
};

const StartNode: NodeComponent = function StartNode({ data }: NodeProps<NodeData>) {
  return <BaseNode data={data} accent={StartNode.accent} color={StartNode.color} />;
};

StartNode.definition = {
  type: "start",
  label: "Start",
  data: { label: "Start" },
};
StartNode.accent = "#eeffec";
StartNode.color = "#d0fccb";

export default StartNode;
