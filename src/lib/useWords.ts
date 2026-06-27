"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchWordById, fetchWords, getFallbackWordById, getFallbackWordsResult, type WordQuery, type WordsResult, type WordSource } from "@/lib/words";
import type { WordEntry } from "@/types/word";

interface WordsState extends WordsResult {
  loading: boolean;
  error: string | null;
}

const emptyResult: WordsResult = {
  words: [],
  total: 0,
  page: 1,
  pageSize: 100,
  units: [],
  source: "supabase",
};

export function useWords(query: WordQuery = {}) {
  const key = useMemo(() => JSON.stringify(query), [query]);
  const [state, setState] = useState<WordsState>({ ...emptyResult, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    const parsedQuery = JSON.parse(key) as WordQuery;
    setState((current) => ({ ...current, loading: true, error: null }));

    if (shouldPreferLocalWords()) {
      const fallback = getFallbackWordsResult(parsedQuery);
      setState({ ...fallback, loading: false, error: null });
      return () => {
        cancelled = true;
      };
    }

    fetchWords(parsedQuery)
      .then((result) => {
        if (!cancelled) {
          setState({ ...result, loading: false, error: null });
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        if (process.env.NODE_ENV !== "production") {
          const fallback = getFallbackWordsResult(parsedQuery);
          setState({ ...fallback, loading: false, error: error instanceof Error ? error.message : "Failed to load Supabase words." });
          return;
        }
        setState({
          ...emptyResult,
          page: parsedQuery.page ?? 1,
          pageSize: parsedQuery.pageSize ?? 100,
          loading: false,
          error: error instanceof Error ? error.message : "Failed to load Supabase words.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return state;
}

export function useWord(id: string | undefined) {
  const [state, setState] = useState<{ word: WordEntry | null; loading: boolean; error: string | null; source: WordSource }>({
    word: null,
    loading: Boolean(id),
    error: null,
    source: "supabase",
  });

  useEffect(() => {
    if (!id) {
      setState({ word: null, loading: false, error: null, source: "supabase" });
      return;
    }

    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));

    if (shouldPreferLocalWords()) {
      const fallbackWord = getFallbackWordById(id);
      setState({
        word: fallbackWord,
        loading: false,
        error: null,
        source: fallbackWord?.id.startsWith("redbook-") ? "redbook-clean-json" : "mock",
      });
      return () => {
        cancelled = true;
      };
    }

    fetchWordById(id)
      .then((word) => {
        if (!cancelled) {
          setState({ word, loading: false, error: null, source: "supabase" });
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        if (process.env.NODE_ENV !== "production") {
          const fallbackWord = getFallbackWordById(id);
          setState({
            word: fallbackWord,
            loading: false,
            error: error instanceof Error ? error.message : "Failed to load Supabase word.",
            source: fallbackWord?.id.startsWith("redbook-") ? "redbook-clean-json" : "mock",
          });
          return;
        }
        setState({
          word: null,
          loading: false,
          error: error instanceof Error ? error.message : "Failed to load Supabase word.",
          source: "supabase",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}

function shouldPreferLocalWords() {
  return true;
}
