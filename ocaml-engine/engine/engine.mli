val execute : graph:Graph.t -> registry:Executor_registry.t -> (Graph.t, Engine_error.t list) result
val execute_node : Graph.t -> Executor_registry.t -> Node.t -> (Graph.t, Engine_error.t list) result
