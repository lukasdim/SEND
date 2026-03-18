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

val make : id:Node_id.t -> node_type:string -> data:payload -> t
