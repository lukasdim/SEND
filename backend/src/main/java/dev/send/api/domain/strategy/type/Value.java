package dev.send.api.domain.strategy.type;

public sealed interface Value permits NumVal, StrVal, BoolVal, NullVal { }