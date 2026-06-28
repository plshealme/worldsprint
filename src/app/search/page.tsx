"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Search, Tag } from "lucide-react";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { useAppState } from "@/components/providers/AppStateProvider";
import { useWords } from "@/lib/useWords";
import { wordSourceLabel } from "@/lib/vocab";

export default function SearchPage() {
  const { getProgress, addTempWord, personalTags, togglePersonalTag } = useAppState();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const normalized = query.trim().toLowerCase();
  const { words, loading, error, source } = useWords({ q: query, pageSize: 100 });

  const results = useMemo(() => {
    if (!normalized) return [];
    return words
      .map((word) => {
        const progress = getProgress(word.id);
        const reasons: string[] = [];
        if (word.word.toLowerCase().includes(normalized)) reasons.push("命中英文单词");
        if (word.coreMeaning.includes(query) || word.fullMeanings?.includes(query)) reasons.push("命中中文意思");
        if (word.officialTags?.some((tag) => tag.includes(query))) reasons.push("命中标签");
        if (word.unit?.toLowerCase().includes(normalized)) reasons.push("命中单元 / 分组");
        if (progress.note.includes(query)) reasons.push("命中个人备注");
        return { word, reasons };
      })
      .filter((item) => item.reasons.length > 0);
  }, [getProgress, normalized, query, words]);

  function toggleSelected(wordId: string) {
    setSelected((current) => (current.includes(wordId) ? current.filter((id) => id !== wordId) : [...current, wordId]));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
        <p className="text-sm font-semibold text-brand">Search</p>
        <h1 className="mt-2 text-2xl font-bold">全局搜索</h1>
        <p className="mt-2 text-sm text-subtle">支持英文单词、中文意思、标签、单元 / 分组和个人备注。</p>
        <p className="mt-2 text-xs text-subtle">
          {loading ? "正在读取词库..." : `当前词库：${wordSourceLabel(source)}`}
        </p>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft">
        <label className="flex min-h-12 items-center gap-2 rounded-lg border border-line bg-surface px-3">
          <Search size={18} className="text-subtle" />
          <input className="w-full bg-transparent outline-none" placeholder="输入关键词" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </section>

      {error ? <p className="rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">{error}</p> : null}

      {selected.length > 0 ? (
        <section className="rounded-lg border border-line bg-panel p-4 shadow-soft">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="font-semibold">已选择 {selected.length} 个词</p>
            <div className="flex flex-wrap gap-2">
              {personalTags.map((tag) => (
                <Button key={tag.id} variant="secondary" onClick={() => selected.forEach((wordId) => togglePersonalTag(wordId, tag.id))}>
                  <Tag size={16} />
                  批量添加 {tag.name}
                </Button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {!normalized ? (
        <EmptyState title="输入关键词开始搜索" description="例如：adapt、释义、Unit 5、标签，或你的个人备注内容。" />
      ) : loading ? (
        <EmptyState title="正在搜索" description="请稍候，正在从词库数据层查询。" />
      ) : results.length === 0 ? (
        <EmptyState title="没有匹配结果" description="换一个关键词试试。" />
      ) : (
        <section className="space-y-3">
          {results.map(({ word, reasons }) => (
            <article key={word.id} className="rounded-lg border border-line bg-panel p-4 shadow-soft">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 gap-3">
                  <input className="mt-2" type="checkbox" checked={selected.includes(word.id)} onChange={() => toggleSelected(word.id)} aria-label={`选择 ${word.word}`} />
                  <Link href={`/words/${word.id}`} className="min-w-0">
                    <h2 className="word-font text-3xl font-bold">{word.word}</h2>
                    <p className="mt-1 text-lg font-semibold">{word.coreMeaning}</p>
                    <p className="mt-2 text-xs text-subtle">
                      {word.category} · {word.unit ?? "未分单元"} · {reasons.join("、")}
                    </p>
                  </Link>
                </div>
                <Button variant="secondary" onClick={() => addTempWord(word.id, "search")}>
                  <Plus size={17} />
                  加入临时测试
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
