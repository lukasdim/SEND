import type { NodeTypes } from "reactflow";
import PriceNode from "./PriceNode";
import IndicatorNode from "./IndicatorNode";
import LogicNode from "./LogicNode";

export const nodeTypes: NodeTypes = {
  price: PriceNode,
  indicator: IndicatorNode,
  logic: LogicNode,
};
