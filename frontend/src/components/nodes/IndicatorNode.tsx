import BaseNode, { type NodeData } from "./BaseNode";

export default function IndicatorNode({ data }: { data: NodeData }) {
  return <BaseNode data={data} accent="#16a34a" />;
}
