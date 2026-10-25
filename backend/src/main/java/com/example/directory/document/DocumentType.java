package com.example.directory.document;

import java.util.Locale;

public enum DocumentType {
    ID_PROOF,
    BUSINESS_LICENSE,
    TAX_CERTIFICATE,
    ADDRESS_PROOF,
    OTHER;

    public static DocumentType from(String value) {
        try {
            return DocumentType.valueOf(value.trim().toUpperCase(Locale.ROOT).replace('-', '_'));
        } catch (Exception ex) {
            throw new IllegalArgumentException("Unknown document type: " + value);
        }
    }
}
