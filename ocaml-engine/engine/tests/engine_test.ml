let assert_true condition message =
  if not condition then failwith message

let expect_ok = function
  | Ok value -> value
  | Error errors ->
      failwith (String.concat " | " (List.map Engine_error.to_string errors))

let node_id value = Node_id.of_string value

let const_number_spec =
  Node.make_spec
    ~node_type:"const_number"
    ~set:"primitive"
    ~display_name:"Const Number"
    ~description:"Const Number"
    ~input_ports:[]
    ~output_ports:[ Node.make_port_spec ~index:0 ~name:"value" ~value:Node.number ]
    ~data_fields:[ Node.make_data_field_spec ~name:"value" ~value:Node.number ]
    ~executor_key:"const_number"

let add_spec =
  Node.make_spec
    ~node_type:"add"
    ~set:"primitive"
    ~display_name:"Add"
    ~description:"Add"
    ~input_ports:
      [
        Node.make_port_spec ~index:0 ~name:"a" ~value:Node.number;
        Node.make_port_spec ~index:1 ~name:"b" ~value:Node.number;
      ]
    ~output_ports:[ Node.make_port_spec ~index:0 ~name:"sum" ~value:Node.number ]
    ~data_fields:[]
    ~executor_key:"add"

let const_number_executor value =
  let run context =
    match Node.find_data_field context.Executor.node "value" with
    | Some field -> Ok [ (0, field.value) ]
    | None -> Ok [ (0, Node.Number_value value) ]
  in
  { Executor.key = "const_number"; run }

let test_execute_graph () =
  let graph =
    Graph.create
      ~node_specs:[ const_number_spec; add_spec ]
      ~nodes:
        [
          Node.make
            ~id:(node_id "a")
            ~node_type:"const_number"
            ~data_fields:[ Node.make_data_field ~name:"value" ~value:(Node.Number_value 2.0) ]
            ();
          Node.make
            ~id:(node_id "b")
            ~node_type:"const_number"
            ~data_fields:[ Node.make_data_field ~name:"value" ~value:(Node.Number_value 3.0) ]
            ();
          Node.make ~id:(node_id "c") ~node_type:"add" ();
        ]
      ~edges:
        [
          Node.make_edge
            ~source:(Node.make_port_ref ~node_id:(node_id "a") ~port_index:0)
            ~target:(Node.make_port_ref ~node_id:(node_id "c") ~port_index:0);
          Node.make_edge
            ~source:(Node.make_port_ref ~node_id:(node_id "b") ~port_index:0)
            ~target:(Node.make_port_ref ~node_id:(node_id "c") ~port_index:1);
        ]
      ()
  in
  let registry =
    Executor_registry.of_list [ const_number_executor 0.0; Add_executor.executor ]
  in
  let executed_graph = Engine.execute ~graph ~registry |> expect_ok in
  let sum_port = Node.make_port_ref ~node_id:(node_id "c") ~port_index:0 in
  assert_true
    (Graph.port_value executed_graph sum_port = Some (Node.Number_value 5.0))
    "expected computed sum"

let test_missing_executor () =
  let graph =
    Graph.create
      ~node_specs:[ add_spec ]
      ~nodes:[ Node.make ~id:(node_id "c") ~node_type:"add" () ]
      ~edges:[]
      ()
  in
  let registry = Executor_registry.empty in
  match Engine.execute ~graph ~registry with
  | Error [ Engine_error.Missing_executor { executor_key = "add"; _ } ] -> ()
  | _ -> failwith "expected missing executor error"

let run_all () =
  test_execute_graph ();
  test_missing_executor ()
