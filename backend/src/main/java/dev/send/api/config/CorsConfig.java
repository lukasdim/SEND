package dev.send.api.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {
  @Override
  public void addCorsMappings(CorsRegistry registry) {
    registry
        .addMapping("/api/**")
        .allowedOrigins(
            "https://sendsys.io",
            "https://www.sendsys.io",
            "http://localhost:5173", // remove after testing (or ad dev opt to enable)
            "http://10.0.0.44:5173" // remove after testing (or ad dev opt to enable)
            )
        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
        .allowedHeaders("*")
        .allowCredentials(false) // for now! until users are implemented
        .maxAge(3600);
  }
}
