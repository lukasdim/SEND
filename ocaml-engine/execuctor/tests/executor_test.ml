let assert_true condition message =
  if not condition then failwith message

let test_Add () =
  let node = Node.make ~id:(Node_id.of_string "add-node") ~node_type:"add" () in
  let node_spec =
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
  in
  match
    Add.executor.Executor.run
      {
        node;
        node_spec;
        inputs = [ (0, Node.Number_value 1.5); (1, Node.Number_value 2.5) ];
      }
  with
  | Ok [ (0, Node.Number_value 4.0) ] -> ()
  | _ -> failwith "expected add executor output"

let test_registry_lookup () =
  let registry = Executor_registry.of_list [ Add.executor ] in
  assert_true (Executor_registry.find "add" registry <> None) "expected executor lookup"

let run_all () =
  test_Add ();
  test_registry_lookup ()
