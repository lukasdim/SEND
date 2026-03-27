package dev.send.api.lectures;

import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.ObjectMapper;

import dev.send.api.worker.infra.ocaml.OcamlWorkerClient;

@SpringBootTest
@AutoConfigureMockMvc
class LectureApiIntegrationTests {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private OcamlWorkerClient ocamlWorkerClient;

    @Test
    void listsAndServesLectureCatalogAndFirstUnlockedSublecture() throws Exception {
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
    void verifyUnlocksNextSublectureAndPersistsCookieBackedProgress() throws Exception {
        String verifyPayload = """
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

        MvcResult verifyResult = mockMvc.perform(post("/api/lectures/foundations--market-graph-basics/checkpoints/checkpoint-place-buy/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(verifyPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passed").value(true))
                .andExpect(jsonPath("$.newlyUnlockedSublectureIndex").value(1))
                .andExpect(cookie().exists("send_lecture_progress"))
                .andReturn();

        String rawCookie = verifyResult.getResponse().getHeader("Set-Cookie");
        String cookieNameValue = rawCookie == null ? "" : rawCookie.substring(0, rawCookie.indexOf(';'));
        String[] cookieParts = cookieNameValue.split("=", 2);
        Cookie lectureProgressCookie = new Cookie(cookieParts[0], cookieParts[1]);

        mockMvc.perform(get("/api/lectures/foundations/market-graph-basics")
                        .cookie(lectureProgressCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sublectures[1].contentSource").exists())
                .andExpect(jsonPath("$.progress.highestUnlockedSublectureIndex").value(1));
    }

    @Test
    void malformedCookieFallsBackToFirstUnlockedSublectureOnly() throws Exception {
        mockMvc.perform(get("/api/lectures/foundations/market-graph-basics")
                        .header("Cookie", "send_lecture_progress=this-is-not-valid"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.progress.highestUnlockedSublectureIndex").value(0))
                .andExpect(jsonPath("$.sublectures[1].contentSource").doesNotExist());
    }

    @Test
    void rejectsOutOfOrderCheckpointVerification() throws Exception {
        String verifyPayload = objectMapper.writeValueAsString(java.util.Map.of("nodes", java.util.List.of(), "edges", java.util.List.of()));

        mockMvc.perform(post("/api/lectures/foundations--market-graph-basics/checkpoints/checkpoint-wire-if/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(verifyPayload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("lecture_validation_failed"));
    }
}
