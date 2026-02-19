import type { JSX } from "react";
import BaseNode, { type NodeData } from "../base/LeftHandle";
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

const OutputNode: NodeComponent = function OutputNode({ data }: NodeProps<NodeData>) {
  return <BaseNode data={data} accent={OutputNode.accent} color={OutputNode.color} />;
};

OutputNode.definition = {
  type: "outputNode",
  label: "Output",
  data: { label: "Output" },
};
OutputNode.accent = "#ff0000";
OutputNode.color = "#ffffff";

export default OutputNode;
