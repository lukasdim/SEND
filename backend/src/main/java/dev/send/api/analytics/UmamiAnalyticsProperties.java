package dev.send.api.analytics;

import java.net.URI;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.web.util.UriComponentsBuilder;

@ConfigurationProperties(prefix = "app.analytics.umami")
public record UmamiAnalyticsProperties(
        String scriptUri,
        String websiteId) {
    public static final String CONFIG_PATH = "/api/analytics/config";
    public static final String SCRIPT_PATH = "/api/analytics/script.js";
    public static final String COLLECT_PATH = "/api/analytics/collect";

    public UmamiAnalyticsProperties {
        if (scriptUri == null || scriptUri.isBlank()) {
            throw new IllegalStateException("app.analytics.umami.script-uri must be configured.");
        }
        if (websiteId == null || websiteId.isBlank()) {
            throw new IllegalStateException("app.analytics.umami.website-id must be configured.");
        }

        try {
            URI parsedScriptUri = URI.create(scriptUri);
            if (!parsedScriptUri.isAbsolute()) {
                throw new IllegalStateException("app.analytics.umami.script-uri must be an absolute URI.");
            }
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("app.analytics.umami.script-uri must be a valid absolute URI.", exception);
        }
    }

    public URI upstreamScriptUri() {
        return URI.create(scriptUri);
    }

    public URI upstreamCollectUri() {
        return UriComponentsBuilder.fromUri(upstreamScriptUri())
                .replacePath(COLLECT_PATH)
                .replaceQuery(null)
                .fragment(null)
                .build(true)
                .toUri();
    }
}
