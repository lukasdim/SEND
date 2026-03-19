package dev.send.api.catalog.api.dto;

import java.util.List;

import javax.annotation.Nullable;

import com.fasterxml.jackson.databind.JsonNode;

public record NodeIoCatalogDto(List<NodeIoDefinitionDto> nodes) {

    public record NodeIoDefinitionDto(
            String nodeType,
            String nodeClass,
            List<NodeIoPortDto> inputs,
            List<NodeIoPortDto> outputs,
            List<NodeIoDataFieldDto> dataFields) {}

    public record NodeIoPortDto(
            int index,
            String name,
            String arity,
            String valueType,
            String valueTypeClass) {}

    public record NodeIoDataFieldDto(
            String name,
            String valueType,
            String valueTypeClass,
            boolean required,
            @Nullable JsonNode defaultValue) {}
}
