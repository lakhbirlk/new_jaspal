package com.example.directory.business;

import java.math.BigDecimal;

/** One declared loan or liability, published by the company for research transparency. */
public record Liability(String type, String lender, BigDecimal amount) {
}
