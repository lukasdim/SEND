package dev.send.api.lectures.application;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.stereotype.Service;

import dev.send.api.lectures.domain.LectureModels.LectureDefinition;
import dev.send.api.lectures.domain.LectureModels.LectureProgress;

@Service
public class LectureProgressService {
    private final LectureProgressStore lectureProgressStore;

    public LectureProgressService(LectureProgressStore lectureProgressStore) {
        this.lectureProgressStore = lectureProgressStore;
    }

    public LectureProgress getProgress(LectureDefinition lecture, HttpServletRequest request) {
        return lectureProgressStore.load(lecture, request);
    }

    public LectureProgress saveProgress(
            LectureDefinition lecture,
            LectureProgress progress,
            HttpServletRequest request,
            HttpServletResponse response) {
        return lectureProgressStore.save(lecture, progress, request, response);
    }
}
