package dev.send.api.domain.strategy.node;

import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AssignableTypeFilter;

import dev.send.api.domain.strategy.Node;
import dev.send.api.domain.strategy.port.Port;
import dev.send.api.domain.strategy.type.Value;

public final class NodeIoRegistry {
    private static final String NODE_PACKAGE = "dev.send.api.domain.strategy.node";
    private static final String SPEC_METHOD = "spec";

    private NodeIoRegistry() {}

    public static List<NodeIo> allNodeIo() {
        ClassPathScanningCandidateComponentProvider scanner =
                new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AssignableTypeFilter(Node.class));

        List<NodeIo> all = new ArrayList<>();

        for (var beanDef : scanner.findCandidateComponents(NODE_PACKAGE)) {
            try {
                Class<?> candidate = Class.forName(beanDef.getBeanClassName());
                if (!Node.class.isAssignableFrom(candidate)) {
                    continue;
                }
                if (Modifier.isAbstract(candidate.getModifiers())) {
                    continue;
                }

                @SuppressWarnings("unchecked")
                Class<? extends Node> nodeClass = (Class<? extends Node>) candidate;
                NodePortSpec spec = readSpec(nodeClass);
                all.add(new NodeIo(nodeClass, spec.inputs(), spec.outputs()));
            } catch (ClassNotFoundException e) {
                throw new IllegalStateException("Failed to load node class while scanning registry", e);
            }
        }

        all.sort(Comparator.comparing(nodeIo -> nodeIo.nodeClass().getName()));
        return List.copyOf(all);
    }

    public static NodeIoCatalog asCatalog() {
        List<NodeIoDto> nodes = allNodeIo().stream()
                .map(nodeIo -> new NodeIoDto(
                        nodeIo.nodeClass().getSimpleName(),
                        nodeIo.nodeClass().getName(),
                        toPortDtos(nodeIo.inputs()),
                        toPortDtos(nodeIo.outputs())))
                .toList();
        return new NodeIoCatalog(nodes);
    }

    private static NodePortSpec readSpec(Class<? extends Node> nodeClass) {
        try {
            Method method = nodeClass.getMethod(SPEC_METHOD);
            if (!Modifier.isStatic(method.getModifiers())) {
                throw new IllegalStateException(
                        String.format("%s.%s must be static", nodeClass.getName(), SPEC_METHOD));
            }
            if (method.getParameterCount() != 0) {
                throw new IllegalStateException(
                        String.format("%s.%s must have no arguments", nodeClass.getName(), SPEC_METHOD));
            }

            Object raw = method.invoke(null);
            if (!(raw instanceof NodePortSpec spec)) {
                throw new IllegalStateException(
                        String.format("%s.%s must return NodePortSpec", nodeClass.getName(), SPEC_METHOD));
            }
            return spec;
        } catch (NoSuchMethodException e) {
            throw new IllegalStateException(
                    String.format("%s is missing required method %s()", nodeClass.getName(), SPEC_METHOD),
                    e);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(
                    String.format("Cannot invoke method %s on %s", SPEC_METHOD, nodeClass.getName()),
                    e);
        }
    }

    public record NodeIo(
            Class<? extends Node> nodeClass,
            Port<? extends Value>[] inputs,
            Port<? extends Value>[] outputs) {}

    private static List<PortDto> toPortDtos(Port<? extends Value>[] ports) {
        List<PortDto> out = new ArrayList<>(ports.length);
        for (Port<? extends Value> port : ports) {
            out.add(new PortDto(
                    port.index(),
                    port.name(),
                    port.arity().name(),
                    port.type().getSimpleName(),
                    port.type().getName()));
        }
        return List.copyOf(out);
    }

    public record NodeIoCatalog(List<NodeIoDto> nodes) {}

    public record NodeIoDto(
            String nodeType,
            String nodeClass,
            List<PortDto> inputs,
            List<PortDto> outputs) {}

    public record PortDto(
            int index,
            String name,
            String arity,
            String valueType,
            String valueTypeClass) {}
}
