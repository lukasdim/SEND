package dev.send.api.lectures.infra;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import dev.send.api.lectures.domain.LectureModels.LectureProgress;

@Component
public class LectureProgressCookieStore {
    private static final String COOKIE_NAME = "send_lecture_progress";

    private final ObjectMapper objectMapper;

    public LectureProgressCookieStore(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public Map<String, LectureProgress> readProgressMap(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Map.of();
        }

        for (Cookie cookie : cookies) {
            if (!COOKIE_NAME.equals(cookie.getName()) || cookie.getValue() == null || cookie.getValue().isBlank()) {
                continue;
            }

            try {
                byte[] decoded = Base64.getUrlDecoder().decode(cookie.getValue());
                Map<String, LectureProgress> parsed = objectMapper.readValue(
                        decoded,
                        new TypeReference<Map<String, LectureProgress>>() {});
                return Map.copyOf(parsed);
            } catch (Exception exception) {
                return Map.of();
            }
        }

        return Map.of();
    }

    public void writeProgressMap(HttpServletResponse response, Map<String, LectureProgress> progressMap) {
        try {
            String json = objectMapper.writeValueAsString(new HashMap<>(progressMap));
            String encoded = Base64.getUrlEncoder()
                    .withoutPadding()
                    .encodeToString(json.getBytes(StandardCharsets.UTF_8));

            ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, encoded)
                    .httpOnly(true)
                    .sameSite("Lax")
                    .path("/api/lectures")
                    .maxAge(Duration.ofDays(30))
                    .build();
            response.addHeader("Set-Cookie", cookie.toString());
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to write lecture progress cookie.", exception);
        }
    }
}
