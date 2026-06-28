"use client";

import { useEffect, useMemo, useState } from "react";
import { getLocalWordById, getLocalWordsResult, type WordQuery, type WordsResult, type WordSource } from "@/lib/localWordsClient";
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
  source: "redbook-clean-json",
};

export function useWords(query: WordQuery = {}) {
  const key = useMemo(() => JSON.stringify(query), [query]);
  const [state, setState] = useState<WordsState>({ ...emptyResult, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    const parsedQuery = JSON.parse(key) as WordQuery;
    setState((current) => ({ ...current, loading: true, error: null }));

    getLocalWordsResult(parsedQuery)
      .then((result) => {
        if (!cancelled) {
          setState({ ...result, loading: false, error: null });
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setState({
          ...emptyResult,
          page: parsedQuery.page ?? 1,
          pageSize: parsedQuery.pageSize ?? 100,
          loading: false,
          error: error instanceof Error ? error.message : "词库加载失败。",
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
    source: "redbook-clean-json",
  });

  useEffect(() => {
    if (!id) {
      setState({ word: null, loading: false, error: null, source: "redbook-clean-json" });
      return;
    }

    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));

    getLocalWordById(id)
      .then((word) => {
        if (!cancelled) {
          setState({ word, loading: false, error: null, source: "redbook-clean-json" });
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setState({
          word: null,
          loading: false,
          error: error instanceof Error ? error.message : "词条加载失败。",
          source: "redbook-clean-json",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}
