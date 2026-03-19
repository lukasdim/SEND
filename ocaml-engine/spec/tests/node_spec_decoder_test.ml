let assert_true condition message =
  if not condition then failwith message

let expect_ok = function
  | Ok value -> value
  | Error error -> failwith (Spec_error.to_string error)

let sample_json =
  {|
  {
    "nodeType": "add",
    "set": "primitive",
    "displayName": "Add",
    "description": "Adds two numbers.",
    "inputs": [
      { "index": 0, "name": "a", "arity": "ONE", "valueType": "NumVal" },
      { "index": 1, "name": "b", "arity": "ONE", "valueType": "NumVal" }
    ],
    "outputs": [
      { "index": 0, "name": "sum", "arity": "ONE", "valueType": "NumVal" }
    ],
    "dataFields": [],
    "executorKey": "add"
  }
|}

let test_decode_sample_spec () =
  let spec = Node_spec_decoder.decode_string sample_json |> expect_ok in
  assert_true (spec.Node.node_type = "add") "wrong node type";
  assert_true (spec.executor_key = "add") "wrong executor key";
  assert_true (List.length spec.input_ports = 2) "wrong input port count";
  assert_true
    (Node.find_input_port_spec spec 0 = Some (Node.make_port_spec ~index:0 ~name:"a" ~value:Node.number))
    "wrong decoded input port"

let test_unknown_value_type () =
  let json =
    {|{"nodeType":"bad","set":"primitive","displayName":"Bad","description":"Bad","inputs":[],"outputs":[{"index":0,"name":"out","arity":"ONE","valueType":"Mystery"}],"dataFields":[],"executorKey":"bad"}|}
  in
  match Node_spec_decoder.decode_string json with
  | Error (Spec_error.Unknown_value_type "Mystery") -> ()
  | _ -> failwith "expected unknown value type error"

let run_all () =
  test_decode_sample_spec ();
  test_unknown_value_type ()
