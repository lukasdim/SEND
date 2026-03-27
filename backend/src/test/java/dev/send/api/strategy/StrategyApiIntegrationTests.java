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
import com.fasterxml.jackson.databind.node.ArrayNode;

import dev.send.api.strategy.domain.StrategyDocument;
import dev.send.api.strategy.application.StrategySimulationBounds;
import dev.send.api.strategy.application.StrategySimulationBoundsService;
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

    @MockBean
    private StrategySimulationBoundsService strategySimulationBoundsService;

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
                .andExpect(jsonPath("$[?(@.id == 's-api-1')]").exists());
    }

    @Test
    void exposesBundledLogicexStrategyForTesting() throws Exception {
        mockMvc.perform(get("/api/strategies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == 'logicex')]").exists())
                .andExpect(jsonPath("$[?(@.id == 'aapl_buy_sell_template')]").exists());

        mockMvc.perform(get("/api/strategies/logicex"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("logicex"))
                .andExpect(jsonPath("$.nodes.length()").value(13))
                .andExpect(jsonPath("$.edges.length()").value(13));

        mockMvc.perform(get("/api/strategies/aapl_buy_sell_template"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("aapl_buy_sell_template"))
                .andExpect(jsonPath("$.nodes.length()").value(11))
                .andExpect(jsonPath("$.edges.length()").value(12));
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

    @Test
    void simulatesGraphThroughOcamlWorkerAndReturnsStructuredSimulationResult() throws Exception {
        ObjectNode result = objectMapper.createObjectNode();
        result.putObject("summary")
                .put("executedDays", 2)
                .put("finalEquity", 1035.5);
        result.putObject("portfolio")
                .put("cash", 900.0);
        result.putObject("finalNodeValues")
                .putObject("buy-1")
                .put("executed", true);
        ArrayNode trace = result.putArray("trace");
        trace.addObject().put("date", "2024-01-02");
        result.putArray("warnings").add("Skipped sell on 2024-01-03.");

        when(ocamlWorkerClient.simulateGraph(
                        any(StrategyDocument.class),
                        any(dev.send.api.worker.application.StrategySimulationConfig.class)))
                .thenReturn(new OcamlExecutionResponse("ok", "simulate_graph", result, null, null, java.util.List.of()));

        String payload = """
                {
                  "strategy": {
                    "id": "draft",
                    "nodes": [
                      {
                        "id": "a",
                        "type": "const_bool",
                        "position": { "x": 0, "y": 0 },
                        "data": { "value": true }
                      }
                    ],
                    "edges": []
                  },
                  "simulation": {
                    "startDate": "2024-01-01",
                    "endDate": "2024-01-31",
                    "initialCash": 1000.0,
                    "includeTrace": true
                  }
                }
                """;

        mockMvc.perform(post("/api/strategies/simulate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.executedDays").value(2))
                .andExpect(jsonPath("$.portfolio.cash").value(900.0))
                .andExpect(jsonPath("$.finalNodeValues.buy-1.executed").value(true))
                .andExpect(jsonPath("$.trace[0].date").value("2024-01-02"))
                .andExpect(jsonPath("$.warnings[0]").value("Skipped sell on 2024-01-03."));
    }

    @Test
    void returnsGlobalSimulationBoundsForSandboxStartup() throws Exception {
        when(strategySimulationBoundsService.getSimulationBounds())
                .thenReturn(new StrategySimulationBounds(true, "2020-04-27", "2025-03-28"));

        mockMvc.perform(get("/api/strategies/simulation-bounds"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasPriceData").value(true))
                .andExpect(jsonPath("$.earliestPriceDate").value("2020-04-27"))
                .andExpect(jsonPath("$.latestPriceDate").value("2025-03-28"));
    }
}
