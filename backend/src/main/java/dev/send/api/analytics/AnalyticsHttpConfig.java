package dev.send.api.analytics;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
public class AnalyticsHttpConfig {
    @Bean
    public RestTemplate analyticsRestTemplate(RestTemplateBuilder builder) {
        return builder.build();
    }
}
