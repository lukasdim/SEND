type t

val create : nodes:Node_instance.t list -> edges:Edge.t list -> (t, Graph_error.t) result

val nodes : t -> Node_instance.t list
val edges : t -> Edge.t list
val find_node : t -> Node_id.t -> Node_instance.t option
val incoming_edges : t -> Port.Ref.t -> Edge.t list
val outgoing_edges : t -> Port.Ref.t -> Edge.t list
val outgoing_edges_for_node : t -> Node_id.t -> Edge.t list
val incoming_count : t -> Node_id.t -> int
val root_nodes : t -> Node_instance.t list
val leaf_nodes : t -> Node_instance.t list
val downstream : t -> Port.Ref.t -> Port.Ref.t list
val topological_sort : t -> (Node_instance.t list, Graph_error.t) result
