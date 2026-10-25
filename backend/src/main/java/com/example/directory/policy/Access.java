package com.example.directory.policy;

public enum Access {
    HIDDEN,
    MASKED,
    READ,
    WRITE;

    public boolean canRead() {
        return this == MASKED || this == READ || this == WRITE;
    }

    public boolean canWrite() {
        return this == WRITE;
    }

    public static Access max(Access a, Access b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.ordinal() >= b.ordinal() ? a : b;
    }
}
