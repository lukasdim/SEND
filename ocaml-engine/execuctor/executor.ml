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

let find_input (inputs : input) index =
  List.assoc_opt index inputs

let run_error_to_string = function
  | Missing_input index -> "Missing input at index " ^ string_of_int index
  | Invalid_input_type { index; expected; actual } ->
      "Invalid input type at index "
      ^ string_of_int index
      ^ ": expected "
      ^ Node.value_label expected
      ^ " but got "
      ^ Node.value_label actual
  | Invalid_output_type { index; expected; actual } ->
      "Invalid output type at index "
      ^ string_of_int index
      ^ ": expected "
      ^ Node.value_label expected
      ^ " but got "
      ^ Node.value_label actual
  | Message message -> message