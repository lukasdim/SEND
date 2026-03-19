type value =
  | Number_value of float
  | Bool_value of bool
  | String_value of string

type port_spec = {
  index : int;
  name : string;
  value : value;
}

type data_field_spec = {
  name : string;
  value : value;
}

type node_spec = {
  node_type : string;
  set : string;
  display_name : string;
  description : string;
  input_ports : port_spec list;
  output_ports : port_spec list;
  data_fields : data_field_spec list;
  executor_key : string;
}

type data_field = {
  name : string;
  value : value;
}

type t = {
  id : Node_id.t;
  node_type : string;
  data_fields : data_field list;
}

type port_ref = {
  node_id : Node_id.t;
  port_index : int;
}

type edge = {
  source : port_ref;
  target : port_ref;
}

let value_label = function
  | Number_value _ -> "number"
  | Bool_value _ -> "bool"
  | String_value _ -> "string"

let same_value_kind left right =
  match (left, right) with
  | Number_value _, Number_value _ -> true
  | Bool_value _, Bool_value _ -> true
  | String_value _, String_value _ -> true
  | _ -> false

let value_to_string = function
  | Number_value value -> string_of_float value
  | Bool_value value -> string_of_bool value
  | String_value value -> value

let number = Number_value 0.0
let bool = Bool_value false
let string = String_value ""
let normalize_number value = Number_value value
let make_port_spec ~index ~name ~value : port_spec = { index; name; value }
let make_data_field_spec ~name ~value : data_field_spec = { name; value }

let make_spec
    ~node_type
    ~set
    ~display_name
    ~description
    ~input_ports
    ~output_ports
    ~data_fields
    ~executor_key
  =
  {
    node_type;
    set;
    display_name;
    description;
    input_ports;
    output_ports;
    data_fields;
    executor_key;
  }

let make_data_field ~name ~value : data_field = { name; value }
let make ?(data_fields = []) ~id ~node_type () = { id; node_type; data_fields }
let make_port_ref ~node_id ~port_index = { node_id; port_index }
let make_edge ~source ~target = { source; target }

let compare_port_ref left right =
  let by_node = Node_id.compare left.node_id right.node_id in
  if by_node <> 0 then by_node else Int.compare left.port_index right.port_index

module Port_ref_map = Stdlib.Map.Make (struct
  type nonrec t = port_ref

  let compare = compare_port_ref
end)

let find_input_port_spec spec port_index =
  List.find_opt (fun port -> port.index = port_index) spec.input_ports

let find_output_port_spec spec port_index =
  List.find_opt (fun port -> port.index = port_index) spec.output_ports

let find_data_field_spec (spec : node_spec) field_name =
  List.find_opt (fun (field : data_field_spec) -> field.name = field_name) spec.data_fields

let find_data_field (node : t) field_name =
  List.find_opt (fun field -> field.name = field_name) node.data_fields
