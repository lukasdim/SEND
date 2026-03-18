type payload =
  | Null
  | Bool of bool
  | Number of float
  | String of string
  | Array of payload list
  | Object of (string * payload) list

type t = {
  id : Node_id.t;
  node_type : string;
  data : payload;
}

let make ~id ~node_type ~data = { id; node_type; data }
