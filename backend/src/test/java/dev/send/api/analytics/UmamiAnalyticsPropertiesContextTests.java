package dev.send.api.analytics;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.context.ConfigurationPropertiesAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

class UmamiAnalyticsPropertiesContextTests {
    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(TestConfig.class)
            .withConfiguration(AutoConfigurations.of(ConfigurationPropertiesAutoConfiguration.class));

    @Test
    void failsWhenScriptUriIsMissing() {
        contextRunner
                .withPropertyValues("app.analytics.umami.website-id=test-website-id")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertRootCauseContains(
                            context.getStartupFailure(),
                            "app.analytics.umami.script-uri must be configured.");
                });
    }

    @Test
    void failsWhenWebsiteIdIsMissing() {
        contextRunner
                .withPropertyValues("app.analytics.umami.script-uri=http://umami.internal/script.js")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertRootCauseContains(
                            context.getStartupFailure(),
                            "app.analytics.umami.website-id must be configured.");
                });
    }

    private void assertRootCauseContains(Throwable failure, String expectedMessage) {
        assertThat(failure).isNotNull();
        assertThat(rootCauseMessage(failure)).contains(expectedMessage);
    }

    private String rootCauseMessage(Throwable failure) {
        Throwable current = failure;
        while (current.getCause() != null) {
            current = current.getCause();
        }
        return current.getMessage() == null ? "" : current.getMessage();
    }

    @Configuration
    @EnableConfigurationProperties(UmamiAnalyticsProperties.class)
    static class TestConfig {
    }
}
