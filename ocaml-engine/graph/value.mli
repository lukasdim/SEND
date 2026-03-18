type t =
  | Number of float
  | Bool of bool
  | String of string
  | Null
  | Unknown

val compare : t -> t -> int
val to_string : t -> string
