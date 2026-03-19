let ( let* ) result f =
  match result with
  | Ok value -> f value
  | Error _ as error -> error

let get_string_field fields field_name =
  match List.assoc_opt field_name fields with
  | Some (`String value) -> Ok value
  | Some _ -> Error (Spec_error.Invalid_field_type field_name)
  | None -> Error (Spec_error.Missing_field field_name)

let get_list_field fields field_name =
  match List.assoc_opt field_name fields with
  | Some (`List values) -> Ok values
  | Some _ -> Error (Spec_error.Invalid_field_type field_name)
  | None -> Error (Spec_error.Missing_field field_name)

let decode_data_type = function
  | "NumVal" -> Ok Node.number
  | "BoolVal" -> Ok Node.bool
  | "StrVal" -> Ok Node.string
  | value_type -> Error (Spec_error.Unknown_value_type value_type)

let decode_port_spec = function
  | `Assoc fields ->
      let* index =
        match List.assoc_opt "index" fields with
        | Some (`Int value) -> Ok value
        | Some _ -> Error (Spec_error.Invalid_field_type "index")
        | None -> Error (Spec_error.Missing_field "index")
      in
      let* name = get_string_field fields "name" in
      let* value_type = get_string_field fields "valueType" in
      let* value = decode_data_type value_type in
      Ok (Node.make_port_spec ~index ~name ~value)
  | _ -> Error (Spec_error.Invalid_field_type "portSpec")

let decode_data_field_spec = function
  | `Assoc fields ->
      let* name = get_string_field fields "name" in
      let* value_type = get_string_field fields "valueType" in
      let* value = decode_data_type value_type in
      Ok (Node.make_data_field_spec ~name ~value)
  | _ -> Error (Spec_error.Invalid_field_type "dataField")

let decode_list decoder values =
  let rec loop acc = function
    | [] -> Ok (List.rev acc)
    | value :: remaining -> (
        match decoder value with
        | Ok decoded -> loop (decoded :: acc) remaining
        | Error _ as error -> error)
  in
  loop [] values

let decode_json json =
  match json with
  | `Assoc fields ->
      let* node_type = get_string_field fields "nodeType" in
      let* set = get_string_field fields "set" in
      let* display_name = get_string_field fields "displayName" in
      let* description = get_string_field fields "description" in
      let* inputs = get_list_field fields "inputs" in
      let* outputs = get_list_field fields "outputs" in
      let* data_fields = get_list_field fields "dataFields" in
      let* executor_key = get_string_field fields "executorKey" in
      let* input_ports = decode_list decode_port_spec inputs in
      let* output_ports = decode_list decode_port_spec outputs in
      let* data_fields = decode_list decode_data_field_spec data_fields in
      Ok
        (Node.make_spec
           ~node_type
           ~set
           ~display_name
           ~description
           ~input_ports
           ~output_ports
           ~data_fields
           ~executor_key)
  | _ -> Error (Spec_error.Invalid_field_type "root")

let decode_string value =
  match Yojson.Safe.from_string value with
  | exception Yojson.Json_error message -> Error (Spec_error.Invalid_json message)
  | json -> decode_json json

let decode_file path =
  let channel = open_in path in
  Fun.protect
    (fun () ->
      let json = Yojson.Safe.from_channel channel in
      decode_json json)
    ~finally:(fun () -> close_in channel)
