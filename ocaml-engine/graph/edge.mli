type t = {
  source : Port.Ref.t;
  target : Port.Ref.t;
}

val compare : t -> t -> int
val make : source:Port.Ref.t -> target:Port.Ref.t -> t
val source_node_id : t -> Node_id.t
val target_node_id : t -> Node_id.t
