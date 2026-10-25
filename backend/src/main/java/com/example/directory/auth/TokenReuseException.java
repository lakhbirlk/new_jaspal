package com.example.directory.auth;

import com.example.directory.common.ApiException;
import org.springframework.http.HttpStatus;

public class TokenReuseException extends ApiException {

    public TokenReuseException() {
        super(HttpStatus.UNAUTHORIZED, "REFRESH_TOKEN_REUSED",
                "This session has been revoked because a used token was replayed");
    }
}
