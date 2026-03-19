type input = (int * Node.value) list
type output = (int * Node.value) list

type run_context = {
  node : Node.t;
  node_spec : Node.node_spec;
  inputs : input;
}

type run_error =
  | Missing_input of int
  | Invalid_input_type of {
      index : int;
      expected : Node.value;
      actual : Node.value;
    }
  | Invalid_output_type of {
      index : int;
      expected : Node.value;
      actual : Node.value;
    }
  | Message of string

type t = {
  key : string;
  run : run_context -> (output, run_error) result;
}

val find_input : input -> int -> Node.value option
val run_error_to_string : run_error -> string
