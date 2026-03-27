package dev.send.api.lectures.application;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import dev.send.api.lectures.api.dto.LectureDtos.LectureCatalogCategoryDto;
import dev.send.api.lectures.api.dto.LectureDtos.LectureCatalogItemDto;
import dev.send.api.lectures.api.dto.LectureDtos.LectureCatalogResponseDto;
import dev.send.api.lectures.api.dto.LectureDtos.LectureCategoryDto;
import dev.send.api.lectures.api.dto.LectureDtos.LectureCheckpointDto;
import dev.send.api.lectures.api.dto.LectureDtos.LectureCheckpointStateDto;
import dev.send.api.lectures.api.dto.LectureDtos.LectureCheckpointTaskDto;
import dev.send.api.lectures.api.dto.LectureDtos.LectureDetailResponseDto;
import dev.send.api.lectures.api.dto.LectureDtos.LectureHeadingDto;
import dev.send.api.lectures.api.dto.LectureDtos.LectureProgressDto;
import dev.send.api.lectures.api.dto.LectureDtos.LectureSandboxEdgeDto;
import dev.send.api.lectures.api.dto.LectureDtos.LectureSandboxNodeDto;
import dev.send.api.lectures.api.dto.LectureDtos.LectureSandboxPresetDto;
import dev.send.api.lectures.api.dto.LectureDtos.LectureSublectureDto;
import dev.send.api.lectures.domain.LectureModels.LectureCheckpoint;
import dev.send.api.lectures.domain.LectureModels.LectureDefinition;
import dev.send.api.lectures.domain.LectureModels.LectureProgress;
import dev.send.api.lectures.domain.LectureModels.LectureSublecture;
import dev.send.api.strategy.api.dto.NodePositionDto;

@Component
public class LectureDtoMapper {
    public LectureCatalogResponseDto toCatalogResponse(List<LectureDefinition> lectures) {
        Map<String, LectureCatalogCategoryDto> categories = new LinkedHashMap<>();

        for (LectureDefinition lecture : lectures) {
            LectureCatalogCategoryDto currentCategory = categories.get(lecture.category().slug());
            List<LectureCatalogItemDto> nextLectures = currentCategory == null
                    ? List.of(toCatalogItem(lecture))
                    : appendLecture(currentCategory.lectures(), toCatalogItem(lecture));
            categories.put(lecture.category().slug(), new LectureCatalogCategoryDto(
                    lecture.category().slug(),
                    lecture.category().title(),
                    lecture.category().description(),
                    lecture.category().hero(),
                    nextLectures));
        }

        return new LectureCatalogResponseDto(List.copyOf(categories.values()));
    }

    public LectureDetailResponseDto toDetailDto(LectureDefinition lecture, LectureProgress progress) {
        return new LectureDetailResponseDto(
                lecture.id(),
                lecture.slug(),
                lecture.category().slug(),
                lecture.title(),
                lecture.summary(),
                lecture.estimatedMinutes(),
                new LectureCategoryDto(
                        lecture.category().slug(),
                        lecture.category().title(),
                        lecture.category().description(),
                        lecture.category().hero()),
                lecture.sublectures().stream()
                        .map(sublecture -> toSublectureDto(lecture, sublecture, progress))
                        .toList(),
                toProgressDto(progress));
    }

    public LectureSublectureDto toUnlockedSublectureDto(LectureDefinition lecture, int index) {
        LectureSublecture sublecture = lecture.sublectures().get(index);
        return new LectureSublectureDto(
                sublecture.id(),
                sublecture.title(),
                sublecture.content(),
                sublecture.headings().stream()
                        .map(heading -> new LectureHeadingDto(heading.id(), heading.title(), heading.level()))
                        .toList(),
                sublecture.checkpointAfter() == null ? null : toCheckpointDto(sublecture.checkpointAfter()),
                true);
    }

    public LectureProgressDto toProgressDto(LectureProgress progress) {
        return new LectureProgressDto(
                progress.lectureId(),
                progress.highestUnlockedSublectureIndex(),
                progress.completedCheckpointIds(),
                progress.activeCheckpointState().entrySet().stream()
                        .collect(java.util.stream.Collectors.toMap(
                                Map.Entry::getKey,
                                entry -> new LectureCheckpointStateDto(
                                        entry.getValue().lastFeedback(),
                                        entry.getValue().lastAttemptedAt(),
                                        entry.getValue().passed()),
                                (left, right) -> right,
                                LinkedHashMap::new)));
    }

    public LectureProgress toDomain(LectureProgressDto progressDto) {
        return new LectureProgress(
                progressDto.lectureId(),
                progressDto.highestUnlockedSublectureIndex(),
                progressDto.completedCheckpointIds() == null ? List.of() : progressDto.completedCheckpointIds(),
                progressDto.activeCheckpointState() == null
                        ? Map.of()
                        : progressDto.activeCheckpointState().entrySet().stream()
                                .collect(java.util.stream.Collectors.toMap(
                                        Map.Entry::getKey,
                                        entry -> new dev.send.api.lectures.domain.LectureModels.LectureCheckpointState(
                                                entry.getValue().lastFeedback(),
                                                entry.getValue().lastAttemptedAt(),
                                                entry.getValue().passed()),
                                        (left, right) -> right,
                                        LinkedHashMap::new)));
    }

    private LectureCatalogItemDto toCatalogItem(LectureDefinition lecture) {
        return new LectureCatalogItemDto(
                lecture.id(),
                lecture.slug(),
                lecture.category().slug(),
                lecture.title(),
                lecture.summary(),
                lecture.estimatedMinutes());
    }

    private List<LectureCatalogItemDto> appendLecture(
            List<LectureCatalogItemDto> currentLectures,
            LectureCatalogItemDto nextLecture) {
        List<LectureCatalogItemDto> lectures = new java.util.ArrayList<>(currentLectures);
        lectures.add(nextLecture);
        return List.copyOf(lectures);
    }

    private LectureSublectureDto toSublectureDto(
            LectureDefinition lecture,
            LectureSublecture sublecture,
            LectureProgress progress) {
        int sublectureIndex = lecture.sublectures().indexOf(sublecture);
        boolean unlocked = sublectureIndex <= progress.highestUnlockedSublectureIndex();
        return new LectureSublectureDto(
                sublecture.id(),
                sublecture.title(),
                unlocked ? sublecture.content() : null,
                sublecture.headings().stream()
                        .map(heading -> new LectureHeadingDto(heading.id(), heading.title(), heading.level()))
                        .toList(),
                unlocked && sublecture.checkpointAfter() != null ? toCheckpointDto(sublecture.checkpointAfter()) : null,
                unlocked);
    }

    private LectureCheckpointDto toCheckpointDto(LectureCheckpoint checkpoint) {
        return new LectureCheckpointDto(
                checkpoint.id(),
                checkpoint.title(),
                checkpoint.instructions(),
                checkpoint.tasks().stream()
                        .map(task -> new LectureCheckpointTaskDto(task.id(), task.label(), task.description()))
                        .toList(),
                new LectureSandboxPresetDto(
                        checkpoint.sandboxPreset().allowedNodeTypes(),
                        checkpoint.sandboxPreset().starterNodes().stream()
                                .map(node -> new LectureSandboxNodeDto(
                                        node.id(),
                                        node.type(),
                                        node.label(),
                                        new NodePositionDto(node.position().x(), node.position().y())))
                                .toList(),
                        checkpoint.sandboxPreset().starterEdges().stream()
                                .map(edge -> new LectureSandboxEdgeDto(edge.id(), edge.source(), edge.target()))
                                .toList()));
    }
}
