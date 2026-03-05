package dev.send.api.domain.strategy.node.value;

import javax.annotation.Nullable;

import dev.send.api.domain.strategy.Node;
import dev.send.api.domain.strategy.port.Port;
import dev.send.api.domain.strategy.type.Value;
import dev.send.api.web.strategy.dto.NodeDto.Position;
// Node specific imports
import dev.send.api.domain.strategy.type.IntVal;

// Maybe allow this node to be a converter node as well
// Ex. Node with string output used as input for this node, which is then converted to int by this node.
public class IntNode extends Node {
    
    public IntNode(String id, Position position, int val) {
        super(id, position, new Value[] { new IntVal(val) });
    }

    /*
    public IntNode(String id, Position position, StrVal val) {
        super(id, position, new Value[] { new IntVal(val) }); // IntVal constructor has conversion logic OR add .toInt() in StrVal
    }
    */

    @Override
    @Nullable
    public Port<? extends Value>[] inputs() {
        return null;
    }

    @Override
    @Nullable
    public Port<? extends Value>[] outputs() {
        return null;
    }
}
