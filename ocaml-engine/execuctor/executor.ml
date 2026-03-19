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

let expect_value index inputs =
  match find_input inputs index with
  | Some value -> Ok value
  | None -> Error (Missing_input index)

let expect_number index inputs =
  match expect_value index inputs with
  | Ok (Node.Number_value value) -> Ok value
  | Ok actual ->
      Error
        (Invalid_input_type
           {
             index;
             expected = Node.number;
             actual;
           })
  | Error _ as error -> error

let expect_bool index inputs =
  match expect_value index inputs with
  | Ok (Node.Bool_value value) -> Ok value
  | Ok actual ->
      Error
        (Invalid_input_type
           {
             index;
             expected = Node.bool;
             actual;
           })
  | Error _ as error -> error

let expect_string index inputs =
  match expect_value index inputs with
  | Ok (Node.String_value value) -> Ok value
  | Ok actual ->
      Error
        (Invalid_input_type
           {
             index;
             expected = Node.string;
             actual;
           })
  | Error _ as error -> error

let find_data_field_value context field_name =
  match Node.find_data_field context.node field_name with
  | Some field ->
      begin
        match Node.find_data_field_spec context.node_spec field_name with
        | Some spec when Node.kind_matches_value spec.value_kind field.value -> Ok field.value
        | Some spec ->
            Error
              (Message
                 ("Data field `"
                 ^ field_name
                 ^ "` expected "
                 ^ Node.value_kind_label spec.value_kind
                 ^ " but got "
                 ^ Node.value_label field.value))
        | None -> Ok field.value
      end
  | None -> (
      match Node.find_data_field_spec context.node_spec field_name with
      | Some spec -> (
          match spec.default_value with
          | Some value -> Ok value
          | None ->
              if spec.required then
                Error (Message ("Missing required data field `" ^ field_name ^ "`"))
              else
                Error (Message ("Missing data field `" ^ field_name ^ "`")))
      | None -> Error (Message ("Unknown data field `" ^ field_name ^ "`")))

let expect_number_field context field_name =
  match find_data_field_value context field_name with
  | Ok (Node.Number_value value) -> Ok value
  | Ok actual ->
      Error
        (Message
           ("Data field `"
           ^ field_name
           ^ "` expected number but got "
           ^ Node.value_label actual))
  | Error _ as error -> error

let expect_bool_field context field_name =
  match find_data_field_value context field_name with
  | Ok (Node.Bool_value value) -> Ok value
  | Ok actual ->
      Error
        (Message
           ("Data field `"
           ^ field_name
           ^ "` expected bool but got "
           ^ Node.value_label actual))
  | Error _ as error -> error

let expect_string_field context field_name =
  match find_data_field_value context field_name with
  | Ok (Node.String_value value) -> Ok value
  | Ok actual ->
      Error
        (Message
           ("Data field `"
           ^ field_name
           ^ "` expected string but got "
           ^ Node.value_label actual))
  | Error _ as error -> error

let single_output index value =
  Ok [ (index, value) ]

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
