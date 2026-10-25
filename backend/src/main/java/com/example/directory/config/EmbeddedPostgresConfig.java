package com.example.directory.config;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import javax.sql.DataSource;
import java.io.IOException;

/**
 * Optional local profile that starts a real PostgreSQL server on a random port so the
 * application can be run without installing PostgreSQL. Production and all real deployments
 * use the configured Postgres datasource. Activate with --spring.profiles.active=embedded.
 */
@Slf4j
@Configuration
@Profile("embedded")
public class EmbeddedPostgresConfig {

    @Bean(destroyMethod = "close")
    public EmbeddedPostgres embeddedPostgres() throws IOException {
        EmbeddedPostgres postgres = EmbeddedPostgres.builder().setPort(0).start();
        log.warn("Started embedded PostgreSQL on port {} (development profile only)",
                postgres.getPort());
        return postgres;
    }

    @Bean
    public DataSource dataSource(EmbeddedPostgres embeddedPostgres) {
        return embeddedPostgres.getPostgresDatabase();
    }
}
