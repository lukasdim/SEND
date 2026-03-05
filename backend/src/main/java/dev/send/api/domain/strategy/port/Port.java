package dev.send.api.domain.strategy.port;

import dev.send.api.domain.strategy.type.Value;

public record Port<T extends Value>(int index, String name, Arity arity, Class<T> type) {}