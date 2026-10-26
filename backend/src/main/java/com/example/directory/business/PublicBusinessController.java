package com.example.directory.business;

import com.example.directory.common.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Public, unauthenticated view of the company catalogue. Only listed businesses are returned,
 * and only through {@link BusinessService#publicList} and {@link BusinessService#publicDetail},
 * which strip identity, contacts and financial detail.
 */
@RestController
@RequestMapping("/api/v1/public")
@RequiredArgsConstructor
public class PublicBusinessController {

    private final BusinessService businessService;

    @GetMapping("/businesses")
    public PageResult<Map<String, Object>> list(@RequestParam(required = false) String q,
                                                @RequestParam(required = false) String industry,
                                                @RequestParam(required = false) String city,
                                                @RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "12") int size) {
        return businessService.publicList(q, industry, city, page, size);
    }

    @GetMapping("/businesses/{id}")
    public Map<String, Object> detail(@PathVariable UUID id) {
        return businessService.publicDetail(id);
    }
}
