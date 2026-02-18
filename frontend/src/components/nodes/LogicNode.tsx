import BaseNode, { type NodeData } from "./BaseNode";

export default function LogicNode({ data }: { data: NodeData }) {
  return <BaseNode data={data} accent="#a855f7" />;
}