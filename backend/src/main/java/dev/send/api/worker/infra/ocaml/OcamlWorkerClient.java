package dev.send.api.worker.infra.ocaml;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import javax.annotation.Nullable;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import dev.send.api.strategy.domain.StrategyDocument;
import dev.send.api.worker.application.StrategyWorkerPayloadMapper;
import jakarta.annotation.PreDestroy;

/**
 * JSON-lines bridge to the OCaml worker process.
 *
 * <p>The worker command is optional for now. When not configured, callers can
 * still use the request-building methods to keep the boundary stable while the
 * OCaml validate/execute handlers are brought online.
 */
@Component
public class OcamlWorkerClient {
    private final ObjectMapper objectMapper;
    private final StrategyWorkerPayloadMapper strategyWorkerPayloadMapper;
    private final String workerCommand;

    @Nullable
    private Process process;
    @Nullable
    private BufferedWriter writer;
    @Nullable
    private BufferedReader reader;

    public OcamlWorkerClient(
            ObjectMapper objectMapper,
            StrategyWorkerPayloadMapper strategyWorkerPayloadMapper,
            @Value("${ocaml.worker.command:}") String workerCommand) {
        this.objectMapper = objectMapper;
        this.strategyWorkerPayloadMapper = strategyWorkerPayloadMapper;
        this.workerCommand = workerCommand;
    }

    public OcamlExecutionRequest createValidateRequest(StrategyDocument strategyDocument) {
        return new OcamlExecutionRequest("validate_graph", strategyWorkerPayloadMapper.toWorkerPayload(strategyDocument));
    }

    public OcamlExecutionRequest createExecuteRequest(StrategyDocument strategyDocument) {
        return new OcamlExecutionRequest("execute_graph", strategyWorkerPayloadMapper.toWorkerPayload(strategyDocument));
    }

    public OcamlExecutionResponse validateGraph(StrategyDocument strategyDocument) {
        return send(createValidateRequest(strategyDocument));
    }

    public OcamlExecutionResponse executeGraph(StrategyDocument strategyDocument) {
        return send(createExecuteRequest(strategyDocument));
    }

    public String encodeRequest(OcamlExecutionRequest request) {
        ObjectNode json = objectMapper.createObjectNode();
        json.put("command", request.command());
        if (request.payload() != null) {
            json.set("payload", request.payload());
        }
        return json.toString();
    }

    public OcamlExecutionResponse decodeResponse(String line) {
        try {
            JsonNode json = objectMapper.readTree(line);
            return new OcamlExecutionResponse(
                    json.path("status").asText(""),
                    textOrNull(json.get("command")),
                    json.get("result"),
                    textOrNull(json.get("code")),
                    textOrNull(json.get("message")),
                    toStringList(json.get("details")));
        } catch (IOException e) {
            throw new IllegalStateException("Failed to decode OCaml worker response.", e);
        }
    }

    private synchronized OcamlExecutionResponse send(OcamlExecutionRequest request) {
        ensureProcess();
        if (writer == null || reader == null) {
            throw new IllegalStateException("OCaml worker streams are not initialized.");
        }

        try {
            writer.write(encodeRequest(request));
            writer.newLine();
            writer.flush();

            String line = reader.readLine();
            if (line == null) {
                throw new IllegalStateException("OCaml worker closed stdout unexpectedly.");
            }
            return decodeResponse(line);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to exchange data with the OCaml worker.", e);
        }
    }

    private void ensureProcess() {
        if (process != null && process.isAlive()) {
            return;
        }
        String resolvedWorkerCommand = resolveWorkerCommand();
        if (resolvedWorkerCommand == null || resolvedWorkerCommand.isBlank()) {
            throw new IllegalStateException(
                    "OCaml worker command is not configured. Set ocaml.worker.command to enable worker calls.");
        }

        try {
            process = new ProcessBuilder("sh", "-lc", resolvedWorkerCommand).start();
            writer = new BufferedWriter(new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8));
            reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new IllegalStateException("Failed to start the OCaml worker process.", e);
        }
    }

    private String resolveWorkerCommand() {
        if (workerCommand != null && !workerCommand.isBlank()) {
            return workerCommand;
        }

        Path currentDirectory = Path.of("").toAbsolutePath();
        List<Path> candidates = List.of(
                currentDirectory.resolve("ocaml-engine"),
                currentDirectory.resolve("../ocaml-engine").normalize());

        for (Path candidate : candidates) {
            if (Files.isDirectory(candidate) && Files.exists(candidate.resolve("dune-project"))) {
                return "cd " + shellEscape(candidate.toString()) + " && dune exec ./bin/worker.exe";
            }
        }

        return workerCommand;
    }

    @Nullable
    private String textOrNull(@Nullable JsonNode jsonNode) {
        if (jsonNode == null || jsonNode.isNull()) {
            return null;
        }
        return jsonNode.asText();
    }

    private List<String> toStringList(@Nullable JsonNode jsonNode) {
        if (jsonNode == null || !jsonNode.isArray()) {
            return List.of();
        }

        List<String> values = new ArrayList<>();
        for (JsonNode value : jsonNode) {
            if (value.isTextual()) {
                values.add(value.asText());
            }
        }
        return List.copyOf(values);
    }

    private String shellEscape(String value) {
        return "'" + value.replace("'", "'\"'\"'") + "'";
    }

    @PreDestroy
    void close() {
        if (process != null) {
            process.destroy();
        }
    }
}
