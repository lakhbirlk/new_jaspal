package com.example.directory.audit;

import com.example.directory.common.ClientInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional
    public void record(UUID actorUserId, String action, String resourceType, UUID resourceId,
                       Object before, Object after) {
        AuditLog entry = new AuditLog();
        entry.setActorUserId(actorUserId);
        entry.setAction(action);
        entry.setResourceType(resourceType);
        entry.setResourceId(resourceId);
        entry.setBeforeState(toJson(before));
        entry.setAfterState(toJson(after));
        entry.setIp(ClientInfo.ip());
        entry.setUserAgent(ClientInfo.userAgent());
        repository.save(entry);
    }

    @Transactional
    public void record(String action, String resourceType, UUID resourceId, Object before, Object after) {
        record(null, action, resourceType, resourceId, before, after);
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            log.warn("Could not serialize audit payload", ex);
            return null;
        }
    }
}
