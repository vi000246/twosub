# Spec Roadmap

> Auto-updated index. Last updated: 2026-06-15
>
> **AI Agents**: Read this file first to decide which specs to load. Load only what's relevant to your task to avoid context bloat.

## Module Index

| Module | Spec | Domain Layer | Description | Sub-modules |
|--------|------|--------------|-------------|-------------|
| twosub | [twosub.spec.md](./twosub.spec.md) | Core Domain | MV3 cross-browser extension overlaying native-first/AI-fallback dual subtitles (EN/ZH) on Netflix, YouTube, HBO Max, with contextual word lookup + TTS. | — |

## Loading Guide

| Task Type | Load These Specs |
|-----------|-----------------|
| 實作特定子模組功能 | 該子模組 spec + parent spec |
| 跨模組整合 | 相關模組各自的 root spec |
| 第一次理解系統 | 先讀本 SPEC_ROADMAP，再按需載入 |

## Recent Feature Changes

| Date | Module | Feature SRS | One-line Summary |
|------|--------|-------------|-----------------|
| 2026-06-15 | twosub | [dual-subtitle-mvp.srs.md](../srs/twosub-dual-subtitle-mvp.srs.md) | v1 of the TwoSub extension: dual EN/ZH subtitles on Netflix/YouTube/HBO Max, native-first + Gemini fallback, BYO key, instant word lookup + TTS, Firefox + Brave. |
