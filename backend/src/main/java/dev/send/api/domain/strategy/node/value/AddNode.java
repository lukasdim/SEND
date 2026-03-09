package dev.send.api.domain.strategy.node.value;

import javax.annotation.Nullable;

import dev.send.api.domain.strategy.Node;
import dev.send.api.domain.strategy.node.NodePortSpec;
import dev.send.api.domain.strategy.port.Arity;
import dev.send.api.domain.strategy.port.Port;
import dev.send.api.domain.strategy.type.Value;
import dev.send.api.web.strategy.dto.NodeDto.Position;
// Node specific imports
import dev.send.api.domain.strategy.type.NumVal;

public class AddNode extends Node {

    private static final NodePortSpec SPEC = NodePortSpec.of(
            new Port<?>[] {
                    new Port<>(0, "a", Arity.ONE, NumVal.class),
                    new Port<>(1, "b", Arity.ONE, NumVal.class)
            },
            new Port<?>[] {
                    new Port<>(0, "sum", Arity.ONE, NumVal.class),
            });

    public static NodePortSpec spec() {
        return SPEC;
    }

    public AddNode(String id, Position position) {
        super(id, position);
    }

    @Override
    public Value[] execute(Value[] inputValues) {
        double a = ((NumVal) inputValues[0]).v();
        double b = ((NumVal) inputValues[1]).v();
        return new Value[] { new NumVal(a + b) };
    }

    @Override
    @Nullable
    public Port<? extends Value>[] inputs() {
        return SPEC.inputs(); // Will need to change to Float or Double Val and then do conversion if necessary
    }

    @Override
    @Nullable
    public Port<? extends Value>[] outputs() {
        return SPEC.outputs();
    }
}
