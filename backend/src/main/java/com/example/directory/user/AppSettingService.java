package com.example.directory.user;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AppSettingService {

    private final AppSettingRepository repository;

    public int getInt(String key, int fallback) {
        return repository.findById(key)
                .map(setting -> {
                    try {
                        return Integer.parseInt(setting.getValue());
                    } catch (NumberFormatException ex) {
                        return fallback;
                    }
                })
                .orElse(fallback);
    }

    public String get(String key, String fallback) {
        return repository.findById(key).map(AppSetting::getValue).orElse(fallback);
    }

    public Map<String, String> all() {
        Map<String, String> result = new LinkedHashMap<>();
        repository.findAll().forEach(setting -> result.put(setting.getKey(), setting.getValue()));
        return result;
    }

    @Transactional
    public void put(Map<String, String> values) {
        values.forEach((key, value) -> {
            AppSetting setting = repository.findById(key).orElseGet(() -> {
                AppSetting created = new AppSetting();
                created.setKey(key);
                return created;
            });
            setting.setValue(value);
            setting.setUpdatedAt(Instant.now());
            repository.save(setting);
        });
    }
}
