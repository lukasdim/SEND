type index = int

module Ref : sig
  type t = {
    node_id : Node_id.t;
    port_index : index;
  }

  val compare : t -> t -> int
  val make : node_id:Node_id.t -> port_index:index -> t
end

module Map : Map.S with type key = Ref.t
