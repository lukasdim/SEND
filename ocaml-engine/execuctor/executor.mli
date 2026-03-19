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
val expect_value : int -> input -> (Node.value, run_error) result
val expect_number : int -> input -> (float, run_error) result
val expect_bool : int -> input -> (bool, run_error) result
val expect_string : int -> input -> (string, run_error) result
val find_data_field_value : run_context -> string -> (Node.value, run_error) result
val expect_number_field : run_context -> string -> (float, run_error) result
val expect_bool_field : run_context -> string -> (bool, run_error) result
val expect_string_field : run_context -> string -> (string, run_error) result
val single_output : int -> Node.value -> (output, run_error) result
val run_error_to_string : run_error -> string
