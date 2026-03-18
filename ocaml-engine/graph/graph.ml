type t = {
  nodes_by_id : Node_instance.t Node_id.Map.t;
  edges : Edge.t list;
  incoming_by_port : Edge.t list Port.Map.t;
  outgoing_by_port : Edge.t list Port.Map.t;
  outgoing_by_node : Edge.t list Node_id.Map.t;
  indegree_by_node : int Node_id.Map.t;
}

let add_to_port_index key edge index =
  let current =
    match Port.Map.find_opt key index with
    | Some edges -> edge :: edges
    | None -> [ edge ]
  in
  Port.Map.add key current index

let add_to_node_index key edge index =
  let current =
    match Node_id.Map.find_opt key index with
    | Some edges -> edge :: edges
    | None -> [ edge ]
  in
  Node_id.Map.add key current index

let reverse_edge_lists_by_port index = Port.Map.map List.rev index
let reverse_edge_lists_by_node index = Node_id.Map.map List.rev index

let insert_node (nodes_by_id, indegree_by_node) node =
  if Node_id.Map.mem node.Node_instance.id nodes_by_id then
    Error (Graph_error.Duplicate_node_id node.id)
  else
    Ok
      ( Node_id.Map.add node.id node nodes_by_id,
        Node_id.Map.add node.id 0 indegree_by_node )

let validate_edge nodes_by_id edge =
  if edge.Edge.source.port_index < 0 || edge.target.port_index < 0 then
    Error (Graph_error.Invalid_edge_endpoint edge)
  else if not (Node_id.Map.mem (Edge.source_node_id edge) nodes_by_id) then
    Error (Graph_error.Missing_source_node (Edge.source_node_id edge))
  else if not (Node_id.Map.mem (Edge.target_node_id edge) nodes_by_id) then
    Error (Graph_error.Missing_target_node (Edge.target_node_id edge))
  else
    Ok ()

let insert_edge (incoming_by_port, outgoing_by_port, outgoing_by_node, indegree_by_node) edge =
  let incoming_by_port = add_to_port_index edge.Edge.target edge incoming_by_port in
  let outgoing_by_port = add_to_port_index edge.Edge.source edge outgoing_by_port in
  let outgoing_by_node =
    add_to_node_index (Edge.source_node_id edge) edge outgoing_by_node
  in
  let current_indegree =
    match Node_id.Map.find_opt (Edge.target_node_id edge) indegree_by_node with
    | Some count -> count
    | None -> 0
  in
  let indegree_by_node =
    Node_id.Map.add
      (Edge.target_node_id edge)
      (current_indegree + 1)
      indegree_by_node
  in
  (incoming_by_port, outgoing_by_port, outgoing_by_node, indegree_by_node)

let create ~nodes ~edges =
  let sorted_edges = List.sort Edge.compare edges in
  let rec build_nodes current = function
    | [] -> Ok current
    | node :: remaining -> (
        match insert_node current node with
        | Ok next -> build_nodes next remaining
        | Error _ as error -> error)
  in
  match build_nodes (Node_id.Map.empty, Node_id.Map.empty) nodes with
  | Error _ as error -> error
  | Ok (nodes_by_id, indegree_by_node) ->
      let rec build_edges current = function
        | [] -> Ok current
        | edge :: remaining -> (
            match validate_edge nodes_by_id edge with
            | Error _ as error -> error
            | Ok () -> build_edges (insert_edge current edge) remaining)
      in
      begin
        match
          build_edges
            (Port.Map.empty, Port.Map.empty, Node_id.Map.empty, indegree_by_node)
            sorted_edges
        with
        | Error _ as error -> error
        | Ok (incoming_by_port, outgoing_by_port, outgoing_by_node, indegree_by_node) ->
            Ok
              {
                nodes_by_id;
                edges = sorted_edges;
                incoming_by_port = reverse_edge_lists_by_port incoming_by_port;
                outgoing_by_port = reverse_edge_lists_by_port outgoing_by_port;
                outgoing_by_node = reverse_edge_lists_by_node outgoing_by_node;
                indegree_by_node;
              }
      end

let nodes graph =
  graph.nodes_by_id |> Node_id.Map.bindings |> List.map snd

let edges graph = graph.edges
let find_node graph node_id = Node_id.Map.find_opt node_id graph.nodes_by_id

let incoming_edges graph port_ref =
  match Port.Map.find_opt port_ref graph.incoming_by_port with
  | Some edges -> edges
  | None -> []

let outgoing_edges graph port_ref =
  match Port.Map.find_opt port_ref graph.outgoing_by_port with
  | Some edges -> edges
  | None -> []

let outgoing_edges_for_node graph node_id =
  match Node_id.Map.find_opt node_id graph.outgoing_by_node with
  | Some edges -> edges
  | None -> []

let incoming_count graph node_id =
  match Node_id.Map.find_opt node_id graph.indegree_by_node with
  | Some count -> count
  | None -> 0

let root_nodes graph =
  graph.nodes_by_id
  |> Node_id.Map.bindings
  |> List.filter_map (fun (node_id, node) ->
         if incoming_count graph node_id = 0 then Some node else None)

let leaf_nodes graph =
  graph.nodes_by_id
  |> Node_id.Map.bindings
  |> List.filter_map (fun (node_id, node) ->
         if outgoing_edges_for_node graph node_id = [] then Some node else None)

let downstream graph port_ref =
  outgoing_edges graph port_ref |> List.map (fun edge -> edge.Edge.target)

let topological_sort graph =
  let initial_queue =
    graph.indegree_by_node
    |> Node_id.Map.bindings
    |> List.filter_map (fun (node_id, count) ->
           if count = 0 then Some node_id else None)
  in
  let rec loop queue indegree_by_node ordered =
    match queue with
    | [] ->
        if List.length ordered = Node_id.Map.cardinal graph.nodes_by_id then
          let ordered_nodes =
            ordered
            |> List.rev
            |> List.filter_map (fun node_id -> find_node graph node_id)
          in
          Ok ordered_nodes
        else
          let cyclic_nodes =
            indegree_by_node
            |> Node_id.Map.bindings
            |> List.filter_map (fun (node_id, count) ->
                   if count > 0 then Some node_id else None)
          in
          Error (Graph_error.Cycle_detected cyclic_nodes)
    | node_id :: remaining_queue ->
        let outgoing = outgoing_edges_for_node graph node_id in
        let indegree_by_node, released_nodes =
          List.fold_left
            (fun (current_indegree, newly_released) edge ->
              let target_id = Edge.target_node_id edge in
              let existing =
                match Node_id.Map.find_opt target_id current_indegree with
                | Some count -> count
                | None -> 0
              in
              let updated = existing - 1 in
              let next_indegree = Node_id.Map.add target_id updated current_indegree in
              if updated = 0 then
                (next_indegree, target_id :: newly_released)
              else
                (next_indegree, newly_released))
            (indegree_by_node, [])
            outgoing
        in
        let next_queue = remaining_queue @ List.rev released_nodes in
        loop next_queue indegree_by_node (node_id :: ordered)
  in
  loop initial_queue graph.indegree_by_node []
