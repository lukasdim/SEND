package dev.send.api.domain.strategy.node;

import dev.send.api.domain.strategy.port.Port;
import dev.send.api.domain.strategy.type.Value;

public final class NodePortSpec {
    private final Port<? extends Value>[] inputs;
    private final Port<? extends Value>[] outputs;

    private NodePortSpec(Port<? extends Value>[] inputs, Port<? extends Value>[] outputs) {
        this.inputs = inputs.clone();
        this.outputs = outputs.clone();
    }

    public static NodePortSpec of(Port<? extends Value>[] inputs, Port<? extends Value>[] outputs) {
        return new NodePortSpec(inputs, outputs);
    }

    public Port<? extends Value>[] inputs() {
        return inputs.clone();
    }

    public Port<? extends Value>[] outputs() {
        return outputs.clone();
    }
}
