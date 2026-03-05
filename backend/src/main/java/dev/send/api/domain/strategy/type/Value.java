package dev.send.api.domain.strategy.type;

public sealed interface Value permits IntVal, StrVal, BoolVal, NullVal { }