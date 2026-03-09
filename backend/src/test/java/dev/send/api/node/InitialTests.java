package dev.send.api.node;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import dev.send.api.domain.strategy.node.NodeIoRegistry;
import dev.send.api.domain.strategy.node.value.AddNode;
import dev.send.api.domain.strategy.node.value.NumNode;
import dev.send.api.domain.strategy.type.NumVal;
import dev.send.api.domain.strategy.type.Value;
import dev.send.api.web.strategy.dto.NodeDto.Position;

@SpringBootTest
class InitialTests {

    // Logic Tests
    @Test
    void numNodeTest() {
        Position p = new Position(10, 32);
        NumNode test = new NumNode("111", p);

        NumVal val = new NumVal(2.4);

        Value[] execOut = test.execute(new Value[] { val });

        assertEquals(val, execOut[0]);
    }

    @Test
    void addNodeTest() {
        Position p = new Position(10, 32);

        NumVal val1 = new NumVal(2.4);
        NumVal val2 = new NumVal(2.6);

        AddNode add = new AddNode("add1", p);

        Value[] exec = add.execute(new Value[] { val1, val2 });
        assertEquals(5.0, ((NumVal) exec[0]).v());
    }

    @Test
    void nodeIoRegistryDiscoversNodePortsWithoutInstantiation() {
        var nodeIo = NodeIoRegistry.allNodeIo();

        assertTrue(nodeIo.stream().anyMatch(n -> n.nodeClass().equals(NumNode.class)));
        assertTrue(nodeIo.stream().anyMatch(n -> n.nodeClass().equals(AddNode.class)));

        var addNodeIo = nodeIo.stream()
                .filter(n -> n.nodeClass().equals(AddNode.class))
                .findFirst()
                .orElseThrow();
        assertEquals(2, addNodeIo.inputs().length);
        assertEquals(1, addNodeIo.outputs().length);
    }

    @Test
    void nodeIoRegistryBuildsFrontendCatalog() {
        var catalog = NodeIoRegistry.asCatalog();
        assertTrue(catalog.nodes().stream().anyMatch(n -> n.nodeType().equals("NumNode")));
        assertTrue(catalog.nodes().stream().anyMatch(n -> n.nodeType().equals("AddNode")));

        var addNode = catalog.nodes().stream()
                .filter(n -> n.nodeType().equals("AddNode"))
                .findFirst()
                .orElseThrow();
        assertEquals(2, addNode.inputs().size());
        assertEquals(1, addNode.outputs().size());
        assertEquals("NumVal", addNode.outputs().getFirst().valueType());
    }

    // Exception Tests
}
