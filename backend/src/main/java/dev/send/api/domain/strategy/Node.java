package dev.send.api.domain.strategy;

import javax.annotation.Nullable;

import dev.send.api.domain.strategy.port.Port;
import dev.send.api.domain.strategy.type.Value;
import dev.send.api.web.strategy.dto.NodeDto.Position; // Will need to change import from DTO record to different record type

public abstract class Node {
    private final String id;
    private final Position position;
    // inputValues may be explicitely typed or connected in the UI. 
    private final Value[] inputValues;

    public Node(String id, Position pos, Value[] inputValues) {
        this.position = pos;
        this.id = id;
        // Perform inputValues validation check here (matches inputs() indices)
        this.inputValues = inputValues;
    }

    // Used to descript inputValues and where to find each value.
    @Nullable public abstract Port<? extends Value>[] inputs();
    @Nullable public abstract Port<? extends Value>[] outputs();

    public <T extends Value> T getInput(Port<T> port) {
        Value v = inputValues[port.index()];
        return port.type().cast(v);
    }

    public Position getPosition() {
        return position;
    }

    public String getId() {
        return id;
    }
}
