package dev.send.api.domain.strategy.node.value;

import javax.annotation.Nullable;

import dev.send.api.domain.strategy.Node;
import dev.send.api.domain.strategy.port.Arity;
import dev.send.api.domain.strategy.port.Port;
import dev.send.api.domain.strategy.type.Value;
import dev.send.api.web.strategy.dto.NodeDto.Position;
// Node specific imports
import dev.send.api.domain.strategy.type.NumVal;

public class AddNode extends Node {
    
    public AddNode(String id, Position position) {
        super(id, position);
    }

    @Override
    public Value[] execute(@Nullable Value[] inputValues) {
        double a = ((NumVal) inputValues[0]).v();
        double b = ((NumVal) inputValues[1]).v();
        return new Value[] { new NumVal(a + b) };
    }

    @Override
    @Nullable
    public Port<? extends Value>[] inputs() {
        return new Port<?>[] { 
            new Port<>(0, "a", Arity.ONE, NumVal.class),
            new Port<>(1, "b", Arity.ONE, NumVal.class)
        }; // Will need to change to Float or Double Val and then do conversion if necessary
    }

    @Override
    @Nullable
    public Port<? extends Value>[] outputs() {
        return new Port<?>[] { 
            new Port<>(0, "sum", Arity.ONE, NumVal.class),
        };
    }
}
