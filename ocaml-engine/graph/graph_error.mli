type t =
  | Duplicate_node_id of Node_id.t
  | Missing_source_node of Node_id.t
  | Missing_target_node of Node_id.t
  | Invalid_edge_endpoint of Edge.t
  | Cycle_detected of Node_id.t list
  | Malformed_graph_input of string

val to_string : t -> string
