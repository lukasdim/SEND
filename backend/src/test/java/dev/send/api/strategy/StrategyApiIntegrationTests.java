package dev.send.api.strategy;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import dev.send.api.strategy.domain.StrategyDocument;
import dev.send.api.worker.infra.ocaml.OcamlExecutionResponse;
import dev.send.api.worker.infra.ocaml.OcamlWorkerClient;

@SpringBootTest
@AutoConfigureMockMvc
class StrategyApiIntegrationTests {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private OcamlWorkerClient ocamlWorkerClient;

    @Test
    void createsListsAndFetchesStrategiesWithHandleAwareEdges() throws Exception {
        String payload = """
                {
                  "id": "s-api-1",
                  "nodes": [
                    {
                      "id": "a",
                      "type": "const_number",
                      "position": { "x": 0, "y": 0 },
                      "data": { "value": 2 }
                    },
                    {
                      "id": "b",
                      "type": "const_number",
                      "position": { "x": 0, "y": 120 },
                      "data": { "value": 3 }
                    },
                    {
                      "id": "c",
                      "type": "add",
                      "position": { "x": 180, "y": 60 },
                      "data": {}
                    }
                  ],
                  "edges": [
                    {
                      "id": "e-1",
                      "source": "a",
                      "target": "c",
                      "sourceHandle": "out:0",
                      "targetHandle": "in:0"
                    },
                    {
                      "id": "e-2",
                      "source": "b",
                      "target": "c",
                      "sourceHandle": "out:0",
                      "targetHandle": "in:1"
                    }
                  ]
                }
                """;

        mockMvc.perform(post("/api/strategies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("s-api-1"))
                .andExpect(jsonPath("$.nodes[0].data.value").value(2))
                .andExpect(jsonPath("$.edges[1].targetHandle").value("in:1"));

        mockMvc.perform(get("/api/strategies/s-api-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("s-api-1"))
                .andExpect(jsonPath("$.edges[0].sourceHandle").value("out:0"));

        mockMvc.perform(get("/api/strategies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("s-api-1"));
    }

    @Test
    void exposesBundledLogicexStrategyForTesting() throws Exception {
        mockMvc.perform(get("/api/strategies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == 'logicex')]").exists());

        mockMvc.perform(get("/api/strategies/logicex"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("logicex"))
                .andExpect(jsonPath("$.nodes.length()").value(13))
                .andExpect(jsonPath("$.edges.length()").value(13));
    }

    @Test
    void testsCurrentGraphThroughOcamlWorkerAndReturnsFlatNodeResults() throws Exception {
        ObjectNode result = objectMapper.createObjectNode();
        result.putObject("c").put("sum", 5);

        when(ocamlWorkerClient.executeGraph(any(StrategyDocument.class)))
                .thenReturn(new OcamlExecutionResponse("ok", "execute_graph", result, null, null, java.util.List.of()));

        String payload = """
                {
                  "id": "draft",
                  "nodes": [
                    {
                      "id": "a",
                      "type": "const_number",
                      "position": { "x": 0, "y": 0 },
                      "data": { "value": 2 }
                    },
                    {
                      "id": "b",
                      "type": "const_number",
                      "position": { "x": 0, "y": 120 },
                      "data": { "value": 3 }
                    },
                    {
                      "id": "c",
                      "type": "add",
                      "position": { "x": 180, "y": 60 },
                      "data": {}
                    }
                  ],
                  "edges": [
                    {
                      "id": "e-1",
                      "source": "a",
                      "target": "c",
                      "sourceHandle": "out:0",
                      "targetHandle": "in:0"
                    },
                    {
                      "id": "e-2",
                      "source": "b",
                      "target": "c",
                      "sourceHandle": "out:0",
                      "targetHandle": "in:1"
                    }
                  ]
                }
                """;

        mockMvc.perform(post("/api/strategies/test")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.c.sum").value(5));
    }

    @Test
    void returnsOcamlExecutionErrorsWithSharedApiErrorShape() throws Exception {
        when(ocamlWorkerClient.executeGraph(any(StrategyDocument.class)))
                .thenReturn(new OcamlExecutionResponse(
                        "error",
                        "execute_graph",
                        null,
                        "graph_validation_failed",
                        "Graph validation failed.",
                        java.util.List.of("Missing source node: a")));

        String payload = """
                {
                  "id": "draft",
                  "nodes": [],
                  "edges": []
                }
                """;

        mockMvc.perform(post("/api/strategies/test")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("graph_validation_failed"))
                .andExpect(jsonPath("$.message").value("Graph validation failed."))
                .andExpect(jsonPath("$.details[0]").value("Missing source node: a"));
    }
}
