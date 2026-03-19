let assert_true condition message =
  if not condition then failwith message

let expect_ok = function
  | Ok value -> value
  | Error errors ->
      failwith (String.concat " | " (List.map Graph_error.to_string errors))

let node_id value = Node_id.of_string value
let port index name value = Node.make_port_spec ~index ~name ~value
let data_field_spec name value = Node.make_data_field_spec ~name ~value
let data_field name value = Node.make_data_field ~name ~value

let spec node_type executor_key ~inputs ~outputs ~data_fields ~display_name =
  Node.make_spec
    ~node_type
    ~set:"primitive"
    ~display_name
    ~description:display_name
    ~input_ports:inputs
    ~output_ports:outputs
    ~data_fields
    ~executor_key

let node ?(data_fields = []) id node_type =
  Node.make ~id:(node_id id) ~node_type ~data_fields ()

let port_ref node_id_value port_index =
  Node.make_port_ref ~node_id:(node_id node_id_value) ~port_index

let edge ~source_node ~source_port ~target_node ~target_port =
  Node.make_edge
    ~source:(port_ref source_node source_port)
    ~target:(port_ref target_node target_port)

let base_specs =
  [
    spec
      "const_number"
      "const_number"
      ~display_name:"Const Number"
      ~inputs:[]
      ~outputs:[ port 0 "value" Node.number ]
      ~data_fields:[ data_field_spec "value" Node.number ];
    spec
      "const_bool"
      "const_bool"
      ~display_name:"Const Bool"
      ~inputs:[]
      ~outputs:[ port 0 "value" Node.bool ]
      ~data_fields:[ data_field_spec "value" Node.bool ];
    spec
      "to_string"
      "to_string"
      ~display_name:"To String"
      ~inputs:[ port 0 "value" Node.number ]
      ~outputs:[ port 0 "text" Node.string ]
      ~data_fields:[];
    spec
      "add"
      "add"
      ~display_name:"Add"
      ~inputs:[ port 0 "a" Node.number; port 1 "b" Node.number ]
      ~outputs:[ port 0 "sum" Node.number ]
      ~data_fields:[];
  ]

let test_port_specs_preserved () =
  let add_spec =
    match List.find_opt (fun (spec : Node.node_spec) -> spec.node_type = "add") base_specs with
    | Some spec -> spec
    | None -> failwith "missing add spec"
  in
  assert_true (List.length add_spec.input_ports = 2) "expected two input ports";
  assert_true (List.length add_spec.output_ports = 1) "expected one output port";
  assert_true
    (Node.find_input_port_spec add_spec 1 = Some (port 1 "b" Node.number))
    "expected input port lookup";
  assert_true
    (Node.find_output_port_spec add_spec 0 = Some (port 0 "sum" Node.number))
    "expected output port lookup";
  assert_true
    (Node.find_data_field_spec (List.hd base_specs) "value" = Some (data_field_spec "value" Node.number))
    "expected data field lookup";
  assert_true (Node.find_input_port_spec add_spec 9 = None) "expected missing port lookup"

let test_validate_unique_nodes_and_types () =
  let graph =
    Graph.create
      ~node_specs:base_specs
      ~nodes:
        [
          node ~data_fields:[ data_field "value" (Node.Number_value 1.0) ] "a" "const_number";
          node "b" "to_string";
        ]
      ~edges:[ edge ~source_node:"a" ~source_port:0 ~target_node:"b" ~target_port:0 ]
      ()
  in
  expect_ok (Graph.validate graph)

let test_duplicate_node_ids_fail () =
  let graph =
    Graph.create
      ~node_specs:base_specs
      ~nodes:[ node "a" "const_number"; node "a" "const_bool" ]
      ~edges:[]
      ()
  in
  match Graph.validate graph with
  | Error [ Graph_error.Duplicate_node_id duplicate ] ->
      assert_true (Node_id.to_string duplicate = "a") "wrong duplicate node id"
  | _ -> failwith "expected duplicate node id error"

let test_missing_node_spec_fail () =
  let graph =
    Graph.create
      ~node_specs:base_specs
      ~nodes:[ node "a" "missing_spec" ]
      ~edges:[]
      ()
  in
  match Graph.validate graph with
  | Error [ Graph_error.Missing_node_spec node_type ] ->
      assert_true (node_type = "missing_spec") "wrong missing node spec"
  | _ -> failwith "expected missing node spec error"

let test_invalid_source_port_fail () =
  let graph =
    Graph.create
      ~node_specs:base_specs
      ~nodes:[ node "a" "const_number"; node "b" "to_string" ]
      ~edges:[ edge ~source_node:"a" ~source_port:9 ~target_node:"b" ~target_port:0 ]
      ()
  in
  match Graph.validate graph with
  | Error [ Graph_error.Invalid_source_port port_ref ] ->
      assert_true (port_ref.port_index = 9) "wrong invalid source port"
  | _ -> failwith "expected invalid source port error"

let test_invalid_target_port_fail () =
  let graph =
    Graph.create
      ~node_specs:base_specs
      ~nodes:[ node "a" "const_number"; node "b" "to_string" ]
      ~edges:[ edge ~source_node:"a" ~source_port:0 ~target_node:"b" ~target_port:9 ]
      ()
  in
  match Graph.validate graph with
  | Error [ Graph_error.Invalid_target_port port_ref ] ->
      assert_true (port_ref.port_index = 9) "wrong invalid target port"
  | _ -> failwith "expected invalid target port error"

let test_type_mismatch_fail () =
  let graph =
    Graph.create
      ~node_specs:base_specs
      ~nodes:[ node "a" "const_bool"; node "b" "to_string" ]
      ~edges:[ edge ~source_node:"a" ~source_port:0 ~target_node:"b" ~target_port:0 ]
      ()
  in
  match Graph.validate graph with
  | Error [ Graph_error.Incompatible_edge_types { source_value = Node.Bool_value _; target_value = Node.Number_value _; _ } ] -> ()
  | _ -> failwith "expected incompatible edge types error"

let test_node_data_field_validation () =
  let graph =
    Graph.create
      ~node_specs:base_specs
      ~nodes:[ node ~data_fields:[ data_field "value" (Node.String_value "bad") ] "a" "const_number" ]
      ~edges:[]
      ()
  in
  match Graph.validate graph with
  | Error [ Graph_error.Invalid_node_data_field { field_name = "value"; expected_value = Node.Number_value _; actual_value = Node.String_value _; _ } ] -> ()
  | _ -> failwith "expected invalid node data field error"

let test_state_type_validation () =
  let graph =
    Graph.create
      ~node_specs:base_specs
      ~nodes:[ node "a" "const_number" ]
      ~edges:[]
      ()
  in
  let output_port = port_ref "a" 0 in
  expect_ok (Graph.set_port_value graph output_port (Node.Number_value 42.0));
  assert_true
    (Graph.port_value graph output_port = Some (Node.Number_value 42.0))
    "expected stored numeric value";
  match Graph.set_port_value graph output_port (Node.Bool_value true) with
  | Error [ Graph_error.Invalid_port_value { expected_value = Node.Number_value _; actual_value = Node.Bool_value _; _ } ] -> ()
  | _ -> failwith "expected invalid port value error"

let test_initial_state_validation () =
  let invalid_port = port_ref "a" 0 in
  let graph =
    Graph.create
      ~node_specs:base_specs
      ~nodes:[ node "a" "const_number" ]
      ~edges:[]
      ~port_values:[ (invalid_port, Node.String_value "bad") ]
      ()
  in
  match Graph.validate graph with
  | Error [ Graph_error.Invalid_port_value { expected_value = Node.Number_value _; actual_value = Node.String_value _; _ } ] -> ()
  | _ -> failwith "expected invalid initial port value error"

let test_topological_sort () =
  let graph =
    Graph.create
      ~node_specs:base_specs
      ~nodes:[ node "a" "const_number"; node "b" "const_number"; node "c" "add" ]
      ~edges:
        [
          edge ~source_node:"a" ~source_port:0 ~target_node:"c" ~target_port:0;
          edge ~source_node:"b" ~source_port:0 ~target_node:"c" ~target_port:1;
        ]
      ()
  in
  let ordered = Graph.topological_sort graph |> expect_ok in
  let ordered_ids = List.map (fun (instance : Node.t) -> Node_id.to_string instance.id) ordered in
  assert_true (ordered_ids = [ "a"; "b"; "c" ]) "unexpected topological ordering"

let test_cycle_detection () =
  let cycle_specs =
    [
      spec
        "forward_number"
        "forward_number"
        ~display_name:"Forward"
        ~inputs:[ port 0 "in" Node.number ]
        ~outputs:[ port 0 "out" Node.number ]
        ~data_fields:[];
    ]
  in
  let graph =
    Graph.create
      ~node_specs:cycle_specs
      ~nodes:[ node "a" "forward_number"; node "b" "forward_number" ]
      ~edges:
        [
          edge ~source_node:"a" ~source_port:0 ~target_node:"b" ~target_port:0;
          edge ~source_node:"b" ~source_port:0 ~target_node:"a" ~target_port:0;
        ]
      ()
  in
  match Graph.topological_sort graph with
  | Error [ Graph_error.Cycle_detected node_ids ] ->
      let ids = List.map Node_id.to_string node_ids in
      assert_true (ids = [ "a"; "b" ]) "unexpected cycle members"
  | _ -> failwith "expected cycle detection"

let run_all () =
  test_port_specs_preserved ();
  test_validate_unique_nodes_and_types ();
  test_duplicate_node_ids_fail ();
  test_missing_node_spec_fail ();
  test_invalid_source_port_fail ();
  test_invalid_target_port_fail ();
  test_type_mismatch_fail ();
  test_node_data_field_validation ();
  test_state_type_validation ();
  test_initial_state_validation ();
  test_topological_sort ();
  test_cycle_detection ()
