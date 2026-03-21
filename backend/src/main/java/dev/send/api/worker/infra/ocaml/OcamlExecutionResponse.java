package dev.send.api.worker.infra.ocaml;

import java.util.List;

import javax.annotation.Nullable;

import com.fasterxml.jackson.databind.JsonNode;

public record OcamlExecutionResponse(
        String status,
        @Nullable String command,
        @Nullable JsonNode result,
        @Nullable String code,
        @Nullable String message,
        List<String> details) {}
