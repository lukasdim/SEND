package dev.send.api.domain.strategy.node.value;

import javax.annotation.Nullable;

import dev.send.api.domain.strategy.Node;
import dev.send.api.domain.strategy.port.Arity;
import dev.send.api.domain.strategy.port.Port;
import dev.send.api.domain.strategy.type.Value;
import dev.send.api.web.strategy.dto.NodeDto.Position;
// Node specific imports
import dev.send.api.domain.strategy.type.NumVal;

// Maybe allow this node to be a converter node as well
// Ex. Node with string output used as input for this node, which is then converted to int by this node.
public class NumNode extends Node {
    
    public NumNode(String id, Position position) {
        super(id, position);
    }

    @Override
    public Value[] execute(Value[] inputValues) {
        return new Value[] { inputValues[0] };
    }

    @Override
    @Nullable
    public Port<? extends Value>[] inputs() {
        return new Port<?>[] { 
            new Port<>(0, "value", Arity.ONE, NumVal.class)
        }; // Determined by content of a text box on the node in frontend graph
    }

    @Override
    @Nullable
    public Port<? extends Value>[] outputs() {
        return null;
    }
}
