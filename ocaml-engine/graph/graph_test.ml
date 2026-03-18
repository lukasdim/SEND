let assert_true condition message =
  if not condition then failwith message

let expect_ok = function
  | Ok value -> value
  | Error error -> failwith (Graph_error.to_string error)

let port node_id port_index =
  Port.Ref.make ~node_id:(Node_id.of_string node_id) ~port_index

let edge ~source_node ~source_port ~target_node ~target_port =
  Edge.make
    ~source:(port source_node source_port)
    ~target:(port target_node target_port)

let node node_id node_type =
  Node_instance.make
    ~id:(Node_id.of_string node_id)
    ~node_type
    ~data:(Node_instance.Object [])

let test_unique_nodes () =
  let graph =
    Graph.create
      ~nodes:[ node "a" "const_number"; node "b" "to_string" ]
      ~edges:[ edge ~source_node:"a" ~source_port:0 ~target_node:"b" ~target_port:0 ]
    |> expect_ok
  in
  assert_true (List.length (Graph.nodes graph) = 2) "expected two nodes";
  assert_true (List.length (Graph.edges graph) = 1) "expected one edge"

let test_duplicate_nodes_fail () =
  match
    Graph.create
      ~nodes:[ node "a" "const_number"; node "a" "const_bool" ]
      ~edges:[]
  with
  | Error (Graph_error.Duplicate_node_id node_id) ->
      assert_true (Node_id.to_string node_id = "a") "wrong duplicate node id"
  | Ok _ ->
      failwith "expected duplicate node id error"
  | Error error ->
      failwith (Graph_error.to_string error)

let test_missing_node_fail () =
  match
    Graph.create
      ~nodes:[ node "a" "const_number" ]
      ~edges:[ edge ~source_node:"a" ~source_port:0 ~target_node:"missing" ~target_port:0 ]
  with
  | Error (Graph_error.Missing_target_node node_id) ->
      assert_true (Node_id.to_string node_id = "missing") "wrong missing target node id"
  | Ok _ ->
      failwith "expected missing target node error"
  | Error error ->
      failwith (Graph_error.to_string error)

let test_topological_sort () =
  let graph =
    Graph.create
      ~nodes:[ node "a" "const_number"; node "b" "const_number"; node "c" "add" ]
      ~edges:
        [
          edge ~source_node:"a" ~source_port:0 ~target_node:"c" ~target_port:0;
          edge ~source_node:"b" ~source_port:0 ~target_node:"c" ~target_port:1;
        ]
    |> expect_ok
  in
  let ordered = Graph.topological_sort graph |> expect_ok in
  let ordered_ids = List.map (fun instance -> Node_id.to_string instance.Node_instance.id) ordered in
  assert_true (ordered_ids = [ "a"; "b"; "c" ]) "unexpected topological ordering"

let test_roots_and_leaves () =
  let graph =
    Graph.create
      ~nodes:
        [ node "a" "const_number"; node "b" "const_number"; node "c" "add"; node "d" "to_string" ]
      ~edges:
        [
          edge ~source_node:"a" ~source_port:0 ~target_node:"c" ~target_port:0;
          edge ~source_node:"b" ~source_port:0 ~target_node:"c" ~target_port:1;
          edge ~source_node:"c" ~source_port:0 ~target_node:"d" ~target_port:0;
        ]
    |> expect_ok
  in
  let roots = Graph.root_nodes graph |> List.map (fun instance -> Node_id.to_string instance.Node_instance.id) in
  let leaves = Graph.leaf_nodes graph |> List.map (fun instance -> Node_id.to_string instance.Node_instance.id) in
  assert_true (roots = [ "a"; "b" ]) "unexpected root nodes";
  assert_true (leaves = [ "d" ]) "unexpected leaf nodes"

let test_downstream_lookup () =
  let graph =
    Graph.create
      ~nodes:[ node "a" "const_number"; node "b" "to_string"; node "c" "to_bool" ]
      ~edges:
        [
          edge ~source_node:"a" ~source_port:0 ~target_node:"b" ~target_port:0;
          edge ~source_node:"a" ~source_port:0 ~target_node:"c" ~target_port:0;
        ]
    |> expect_ok
  in
  let downstream =
    Graph.downstream graph (port "a" 0)
    |> List.map (fun ref -> (Node_id.to_string ref.Port.Ref.node_id, ref.port_index))
  in
  assert_true
    (downstream = [ ("b", 0); ("c", 0) ])
    "unexpected downstream port references"

let test_cycle_detection () =
  let graph =
    Graph.create
      ~nodes:[ node "a" "add"; node "b" "subtract" ]
      ~edges:
        [
          edge ~source_node:"a" ~source_port:0 ~target_node:"b" ~target_port:0;
          edge ~source_node:"b" ~source_port:0 ~target_node:"a" ~target_port:0;
        ]
    |> expect_ok
  in
  match Graph.topological_sort graph with
  | Error (Graph_error.Cycle_detected node_ids) ->
      let ids = List.map Node_id.to_string node_ids in
      assert_true (ids = [ "a"; "b" ]) "unexpected cycle members"
  | Ok _ ->
      failwith "expected cycle detection"
  | Error error ->
      failwith (Graph_error.to_string error)

let run_all () =
  test_unique_nodes ();
  test_duplicate_nodes_fail ();
  test_missing_node_fail ();
  test_topological_sort ();
  test_roots_and_leaves ();
  test_downstream_lookup ();
  test_cycle_detection ()
