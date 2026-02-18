import BaseNode, { type NodeData } from "./BaseNode";

export default function PriceNode({ data }: { data: NodeData }) {
  return <BaseNode data={data} accent="#2563eb" />;
}
