let stub_result message = `Assoc [ ("message", `String message) ]

let handle_validate_graph request =
  Worker_protocol.Success
    {
      command = request.Worker_protocol.command;
      result = stub_result "stubbed validate_graph response";
    }

let handle_execute_graph request =
  Worker_protocol.Success
    {
      command = request.Worker_protocol.command;
      result = stub_result "stubbed execute_graph response";
    }

let handle_request request =
  match request.Worker_protocol.command with
  | Worker_protocol.Validate_graph -> handle_validate_graph request
  | Worker_protocol.Execute_graph -> handle_execute_graph request
