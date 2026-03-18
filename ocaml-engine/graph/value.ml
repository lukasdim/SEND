type t =
  | Number of float
  | Bool of bool
  | String of string
  | Null
  | Unknown

let compare = Stdlib.compare

let to_string = function
  | Number value -> string_of_float value
  | Bool value -> string_of_bool value
  | String value -> value
  | Null -> "null"
  | Unknown -> "unknown"
