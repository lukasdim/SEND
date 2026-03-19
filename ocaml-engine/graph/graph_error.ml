type t =
  | Duplicate_node_id of Node_id.t
  | Duplicate_node_type of string
  | Missing_node_spec of string
  | Missing_source_node of Node_id.t
  | Missing_target_node of Node_id.t
  | Invalid_source_port of Node.port_ref
  | Invalid_target_port of Node.port_ref
  | Incompatible_edge_types of {
      source : Node.port_ref;
      target : Node.port_ref;
      source_value : Node.value;
      target_value : Node.value;
    }
  | Unknown_data_field of {
      node_id : Node_id.t;
      field_name : string;
    }
  | Invalid_node_data_field of {
      node_id : Node_id.t;
      field_name : string;
      expected_value : Node.value;
      actual_value : Node.value;
    }
  | Invalid_port_value of {
      port : Node.port_ref;
      expected_value : Node.value;
      actual_value : Node.value;
    }
  | Cycle_detected of Node_id.t list

let port_ref_to_string port =
  Node_id.to_string port.Node.node_id ^ ":" ^ string_of_int port.port_index

let to_string = function
  | Duplicate_node_id node_id ->
      "Duplicate node id: " ^ Node_id.to_string node_id
  | Duplicate_node_type node_type ->
      "Duplicate node type: " ^ node_type
  | Missing_node_spec node_type ->
      "Missing node spec for node type: " ^ node_type
  | Missing_source_node node_id ->
      "Missing source node: " ^ Node_id.to_string node_id
  | Missing_target_node node_id ->
      "Missing target node: " ^ Node_id.to_string node_id
  | Invalid_source_port port ->
      "Invalid source port: " ^ port_ref_to_string port
  | Invalid_target_port port ->
      "Invalid target port: " ^ port_ref_to_string port
  | Incompatible_edge_types { source; target; source_value; target_value } ->
      "Incompatible edge types: "
      ^ port_ref_to_string source
      ^ " ("
      ^ Node.value_label source_value
      ^ ") -> "
      ^ port_ref_to_string target
      ^ " ("
      ^ Node.value_label target_value
      ^ ")"
  | Unknown_data_field { node_id; field_name } ->
      "Unknown data field on node "
      ^ Node_id.to_string node_id
      ^ ": "
      ^ field_name
  | Invalid_node_data_field { node_id; field_name; expected_value; actual_value } ->
      "Invalid data field on node "
      ^ Node_id.to_string node_id
      ^ " field "
      ^ field_name
      ^ " expected "
      ^ Node.value_label expected_value
      ^ " but got "
      ^ Node.value_label actual_value
  | Invalid_port_value { port; expected_value; actual_value } ->
      "Invalid port value: "
      ^ port_ref_to_string port
      ^ " expected "
      ^ Node.value_label expected_value
      ^ " but got "
      ^ Node.value_label actual_value
  | Cycle_detected node_ids ->
      "Cycle detected among nodes: "
      ^ String.concat ", " (List.map Node_id.to_string node_ids)
