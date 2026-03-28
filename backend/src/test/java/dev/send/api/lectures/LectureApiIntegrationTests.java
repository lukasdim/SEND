package dev.send.api.lectures;

import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

import org.junit.jupiter.api.BeforeEach;
import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import dev.send.api.worker.infra.ocaml.OcamlWorkerClient;

@SpringBootTest
@AutoConfigureMockMvc
class LectureApiIntegrationTests {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OcamlWorkerClient ocamlWorkerClient;

    @MockBean
    private JwtDecoder jwtDecoder;

    @BeforeEach
    void setUpJwtDecoder() {
        when(jwtDecoder.decode("valid-user-1")).thenReturn(validJwt("supabase-user-1", "user1@example.com"));
        when(jwtDecoder.decode("valid-user-2")).thenReturn(validJwt("supabase-user-2", "user2@example.com"));
    }

    @Test
    void listsAndServesLectureCatalogAndFirstUnlockedSublectureAnonymously() throws Exception {
        mockMvc.perform(get("/api/lectures"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categories[0].slug").value("foundations"))
                .andExpect(jsonPath("$.categories[0].lectures[0].slug").value("market-graph-basics"));

        mockMvc.perform(get("/api/lectures/foundations/market-graph-basics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("foundations--market-graph-basics"))
                .andExpect(jsonPath("$.sublectures[0].contentSource").exists())
                .andExpect(jsonPath("$.sublectures[1].contentSource").doesNotExist())
                .andExpect(jsonPath("$.progress.highestUnlockedSublectureIndex").value(0));
    }

    @Test
    void anonymousCheckpointVerificationStillPersistsCookieBackedProgress() throws Exception {
        MvcResult verifyResult = mockMvc.perform(post("/api/lectures/foundations--market-graph-basics/checkpoints/checkpoint-place-buy/verify")
                        .contentType(APPLICATION_JSON)
                        .content(verifyPayload()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passed").value(true))
                .andExpect(jsonPath("$.newlyUnlockedSublectureIndex").value(1))
                .andExpect(cookie().exists("send_lecture_progress"))
                .andReturn();

        Cookie lectureProgressCookie = parseLectureProgressCookie(verifyResult);

        mockMvc.perform(get("/api/lectures/foundations/market-graph-basics")
                        .cookie(lectureProgressCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sublectures[1].contentSource").exists())
                .andExpect(jsonPath("$.progress.highestUnlockedSublectureIndex").value(1));
    }

    @Test
    void authenticatedLectureReadsImportCookieProgressOnceAndThenPreferDatabaseState() throws Exception {
        MvcResult verifyResult = mockMvc.perform(post("/api/lectures/foundations--market-graph-basics/checkpoints/checkpoint-place-buy/verify")
                        .contentType(APPLICATION_JSON)
                        .content(verifyPayload()))
                .andExpect(status().isOk())
                .andReturn();

        Cookie importedCookie = parseLectureProgressCookie(verifyResult);

        mockMvc.perform(get("/api/lectures/foundations/market-graph-basics")
                        .header("Authorization", "Bearer valid-user-1")
                        .cookie(importedCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.progress.highestUnlockedSublectureIndex").value(1))
                .andExpect(jsonPath("$.sublectures[1].contentSource").exists());

        mockMvc.perform(get("/api/lectures/foundations/market-graph-basics")
                        .header("Authorization", "Bearer valid-user-1")
                        .header("Cookie", "send_lecture_progress=malformed-cookie"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.progress.highestUnlockedSublectureIndex").value(1))
                .andExpect(jsonPath("$.sublectures[1].contentSource").exists());
    }

    @Test
    void authenticatedCheckpointVerificationPersistsWithoutRelyingOnCookieState() throws Exception {
        mockMvc.perform(post("/api/lectures/foundations--market-graph-basics/checkpoints/checkpoint-place-buy/verify")
                        .header("Authorization", "Bearer valid-user-2")
                        .contentType(APPLICATION_JSON)
                        .content(verifyPayload()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passed").value(true))
                .andExpect(jsonPath("$.newlyUnlockedSublectureIndex").value(1));

        mockMvc.perform(get("/api/lectures/foundations/market-graph-basics")
                        .header("Authorization", "Bearer valid-user-2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.progress.highestUnlockedSublectureIndex").value(1))
                .andExpect(jsonPath("$.sublectures[1].contentSource").exists());
    }

    @Test
    void rejectsOutOfOrderCheckpointVerification() throws Exception {
        mockMvc.perform(post("/api/lectures/foundations--market-graph-basics/checkpoints/checkpoint-wire-if/verify")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "nodes": [],
                                  "edges": []
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("lecture_validation_failed"));
    }

    private Cookie parseLectureProgressCookie(MvcResult verifyResult) {
        String rawCookie = verifyResult.getResponse().getHeader("Set-Cookie");
        String cookieNameValue = rawCookie == null ? "" : rawCookie.substring(0, rawCookie.indexOf(';'));
        String[] cookieParts = cookieNameValue.split("=", 2);
        return new Cookie(cookieParts[0], cookieParts[1]);
    }

    private String verifyPayload() {
        return """
                {
                  "nodes": [
                    {
                      "id": "buy-1",
                      "type": "buy",
                      "position": { "x": 50, "y": 50 },
                      "data": { "ticker": "AAPL" }
                    }
                  ],
                  "edges": []
                }
                """;
    }

    private Jwt validJwt(String subject, String email) {
        Instant now = Instant.now();
        return Jwt.withTokenValue("test-jwt-" + subject)
                .header("alg", "RS256")
                .claim("sub", subject)
                .claim("email", email)
                .claim("aud", java.util.List.of("authenticated"))
                .claim("iss", "https://test-project.supabase.co/auth/v1")
                .claim("role", "authenticated")
                .issuedAt(now.minusSeconds(60))
                .expiresAt(now.plusSeconds(3600))
                .build();
    }
}
