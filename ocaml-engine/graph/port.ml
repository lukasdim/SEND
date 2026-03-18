type index = int

module Ref = struct
  type t = {
    node_id : Node_id.t;
    port_index : index;
  }

  let compare left right =
    let by_node = Node_id.compare left.node_id right.node_id in
    if by_node <> 0 then by_node else Int.compare left.port_index right.port_index

  let make ~node_id ~port_index = { node_id; port_index }
end

module Map = Stdlib.Map.Make (Ref)
