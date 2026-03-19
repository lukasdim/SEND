let expect_number index inputs =
  match Executor.find_input inputs index with
  | Some (Node.Number_value value) -> Ok value
  | Some value ->
      Error
        (Executor.Invalid_input_type
           {
             index;
             expected = Node.number;
             actual = value;
           })
  | None -> Error (Executor.Missing_input index)

let run context =
  match expect_number 0 context.Executor.inputs with
  | Error _ as error -> error
  | Ok left -> (
      match expect_number 1 context.inputs with
      | Error _ as error -> error
      | Ok right ->
          Ok [ (0, Node.normalize_number (left -. right)) ])

let executor = { Executor.key = "sub"; run }
