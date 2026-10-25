package com.example.directory.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Serves the exported single-page web client for its public deep links (the paths used by
 * verification, password-reset and invitation emails). The client reads the query token and
 * then rewrites the address bar to "/" before rendering.
 *
 * <p>Only public routes are forwarded. Authenticated screens are reachable through in-app
 * navigation, so refreshing them is not part of the flow.</p>
 */
@Controller
public class SpaController {

    @GetMapping({"/login", "/register", "/forgot-password", "/accept-invite",
            "/reset-password", "/verify-email"})
    public String forwardPublicRoutes() {
        return "forward:/index.html";
    }
}
