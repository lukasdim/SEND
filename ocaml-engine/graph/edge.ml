type t = {
  source : Port.Ref.t;
  target : Port.Ref.t;
}

let compare left right =
  let by_source = Port.Ref.compare left.source right.source in
  if by_source <> 0 then by_source else Port.Ref.compare left.target right.target

let make ~source ~target = { source; target }
let source_node_id edge = edge.source.node_id
let target_node_id edge = edge.target.node_id
