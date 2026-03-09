package dev.send.api.domain.strategy;

import javax.annotation.Nullable;

import dev.send.api.domain.strategy.port.Port;
import dev.send.api.domain.strategy.type.Value;
import dev.send.api.web.strategy.dto.NodeDto.Position; // Will need to change import from DTO record to different record type

public abstract class Node {
    private final String id;
    private final Position position;
    // inputValues may be explicitely typed or connected in the UI.
    private Value[] inputValues = {};

    public Node(String id, Position pos) {
        this.position = pos;
        this.id = id;
    }

    public abstract Value[] execute(Value[] inputValues);

    // Used to descript inputValues and where to find each value.
    @Nullable
    public abstract Port<? extends Value>[] inputs();

    @Nullable
    public abstract Port<? extends Value>[] outputs();

    public <T extends Value> T getInput(Port<T> port) throws IllegalArgumentException {
        if (port.index() >= inputValues.length)
            throw new IllegalArgumentException(
                    String.format("Error accessing index %d of %s input values; does not exist.", port.index(),
                            getClass().getSimpleName()));
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
