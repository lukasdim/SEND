type t =
  | Duplicate_node_id of Node_id.t
  | Missing_source_node of Node_id.t
  | Missing_target_node of Node_id.t
  | Invalid_edge_endpoint of Edge.t
  | Cycle_detected of Node_id.t list
  | Malformed_graph_input of string

let to_string = function
  | Duplicate_node_id node_id ->
      "Duplicate node id: " ^ Node_id.to_string node_id
  | Missing_source_node node_id ->
      "Missing source node: " ^ Node_id.to_string node_id
  | Missing_target_node node_id ->
      "Missing target node: " ^ Node_id.to_string node_id
  | Invalid_edge_endpoint edge ->
      "Invalid edge endpoint: "
      ^ Node_id.to_string edge.source.node_id
      ^ ":" ^ string_of_int edge.source.port_index
      ^ " -> "
      ^ Node_id.to_string edge.target.node_id
      ^ ":" ^ string_of_int edge.target.port_index
  | Cycle_detected node_ids ->
      "Cycle detected among nodes: "
      ^ String.concat ", " (List.map Node_id.to_string node_ids)
  | Malformed_graph_input message ->
      "Malformed graph input: " ^ message
