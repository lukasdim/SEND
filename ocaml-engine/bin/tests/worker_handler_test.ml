let assert_true condition message =
  if not condition then failwith message

let test_handle_validate_graph () =
  let request =
    {
      Worker_protocol.command = Worker_protocol.Validate_graph;
      payload = None;
    }
  in
  match Worker_handler.handle_request request with
  | Worker_protocol.Success { command = Worker_protocol.Validate_graph; result } ->
      assert_true
        (Yojson.Safe.Util.member "message" result = `String "stubbed validate_graph response")
        "expected validate_graph stub result"
  | _ -> failwith "expected validate_graph success response"

let test_handle_execute_graph () =
  let request =
    {
      Worker_protocol.command = Worker_protocol.Execute_graph;
      payload = Some (`Assoc [ ("entrypoint", `String "main") ]);
    }
  in
  match Worker_handler.handle_request request with
  | Worker_protocol.Success { command = Worker_protocol.Execute_graph; result } ->
      assert_true
        (Yojson.Safe.Util.member "message" result = `String "stubbed execute_graph response")
        "expected execute_graph stub result"
  | _ -> failwith "expected execute_graph success response"

let run_all () =
  test_handle_validate_graph ();
  test_handle_execute_graph ()
