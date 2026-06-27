"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Heart, Plus, Tag, Target } from "lucide-react";
import { Button, ButtonLink } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { useAppState } from "@/components/providers/AppStateProvider";
import { useWord } from "@/lib/useWords";
import { formatPercent, masteryName, shortDateTime } from "@/lib/utils";
import { wordSourceLabel } from "@/lib/words";
import type { MasteryStatus } from "@/types/word";

const masteryOptions: Array<{ value: MasteryStatus; label: string }> = [
  { value: "mastered", label: "已掌握" },
  { value: "known", label: "认识" },
  { value: "vague", label: "模糊" },
  { value: "unknown", label: "不认识" },
];

export default function WordDetailPage() {
  const params = useParams<{ id: string }>();
  const { word, loading, error, source } = useWord(params.id);
  const { getProgress, toggleFavorite, saveNote, setMastery, personalTags, togglePersonalTag, addTempWord, tempList } = useAppState();

  if (loading) {
    return <EmptyState title="正在读取词条" description="请稍候，正在从词库数据层加载单词详情。" />;
  }

  if (!word) {
    return <EmptyState title="没有找到这个词条" description={error ?? "词条可能已被更新或隐藏。"} actionHref="/review" actionLabel="返回 Review" />;
  }

  const progress = getProgress(word.id);
  const accuracy = progress.attempts ? progress.correctCount / progress.attempts : 0;
  const inTemp = tempList.some((item) => item.wordId === word.id);

  return (
    <div className="space-y-6">
      {error ? <p className="rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">{error}</p> : null}
      <section className="rounded-lg border border-line bg-panel p-6 shadow-soft">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="word-font text-6xl font-bold">{word.word}</h1>
              <span className="rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-brand">{masteryName(progress.masteryLevel)}</span>
              {progress.isMistake ? <span className="rounded-full bg-danger/10 px-3 py-1 text-sm font-semibold text-danger">错题</span> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-subtle">
              {word.phonetic ? <span>{word.phonetic}</span> : null}
              {word.partOfSpeech ? <span>{word.partOfSpeech}</span> : null}
              {word.unit ? <span>{word.unit}</span> : null}
              {word.page ? <span>p.{word.page}</span> : null}
              <span>{wordSourceLabel(source)}</span>
            </div>
            <p className="mt-5 text-2xl font-bold">{word.coreMeaning}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => toggleFavorite(word.id, word.word)}>
              <Heart size={17} className={progress.isFavorite ? "fill-current text-danger" : ""} />
              {progress.isFavorite ? "已收藏" : "收藏"}
            </Button>
            <Button variant="secondary" onClick={() => addTempWord(word.id, "word-detail")} disabled={inTemp}>
              <Plus size={17} />
              {inTemp ? "已加入" : "临时测试"}
            </Button>
            <ButtonLink href="/temp-list">
              <Target size={17} />
              开始单测
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {word.fullMeanings ? <DetailBlock title="完整释义" text={word.fullMeanings} /> : null}
          {word.example ? <DetailBlock title="例句" text={word.example} /> : null}
          {word.collocation ? <DetailBlock title="搭配" text={word.collocation} /> : null}
          {word.officialTags?.length ? <DetailBlock title="官方标签" text={word.officialTags.join("、")} /> : null}
          {word.similarWordsGroup?.length ? <DetailBlock title="形近词组" text={word.similarWordsGroup.join(" / ")} /> : null}
          {word.synonymGroup?.length ? <DetailBlock title="意近词组" text={word.synonymGroup.join(" / ")} /> : null}
          {word.confusableNotes ? <DetailBlock title="辨析说明" text={word.confusableNotes} /> : null}
          {word.familiarMeaningNotes ? <DetailBlock title="熟词僻义说明" text={word.familiarMeaningNotes} /> : null}
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-line bg-panel p-4 shadow-soft">
            <h2 className="font-bold">个人状态</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {masteryOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={progress.masteryLevel === option.value ? "primary" : "secondary"}
                  onClick={() => setMastery(word.id, option.value, word.word)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-panel p-4 shadow-soft">
            <h2 className="font-bold">学习记录</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <SmallStat label="练习次数" value={progress.attempts} />
              <SmallStat label="答对次数" value={progress.correctCount} />
              <SmallStat label="答错次数" value={progress.wrongCount} />
              <SmallStat label="正确率" value={formatPercent(accuracy)} />
              <SmallStat label="熟练度" value={masteryName(progress.masteryLevel)} />
              <SmallStat label="错题" value={progress.isMistake ? "是" : "否"} />
              <SmallStat label="收藏" value={progress.isFavorite ? "是" : "否"} />
              <SmallStat label="上次结果" value={progress.lastAnswerCorrect === undefined ? "暂无" : progress.lastAnswerCorrect ? "答对" : "答错"} />
            </div>
            <p className="mt-3 text-xs text-subtle">最近练习：{shortDateTime(progress.lastPracticedAt)}</p>
            <p className="mt-1 text-xs text-subtle">下次复习：{shortDateTime(progress.nextReviewAt)}</p>
          </div>

          <div className="rounded-lg border border-line bg-panel p-4 shadow-soft">
            <div className="flex items-center gap-2">
              <Tag size={17} className="text-brand" />
              <h2 className="font-bold">个人标签</h2>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {personalTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => togglePersonalTag(word.id, tag.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    progress.personalTagIds.includes(tag.id) ? "bg-brand text-white" : "bg-muted text-subtle"
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-panel p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">个人备注</h2>
              <span className="text-xs text-subtle">{progress.note.length}/100</span>
            </div>
            <textarea
              className="mt-3 min-h-28 w-full rounded-lg border border-line bg-surface p-3 outline-none"
              value={progress.note}
              maxLength={100}
              onChange={(event) => saveNote(word.id, event.target.value)}
              placeholder="纯文本备注，最多 100 字"
            />
          </div>
        </aside>
      </section>

      <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
        <h2 className="text-lg font-bold">相关操作</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLink href="/practice" variant="secondary">
            单词单测
          </ButtonLink>
          <ButtonLink href="/review" variant="secondary">
            返回复习
          </ButtonLink>
          <Link href="/search" className="inline-flex min-h-11 items-center rounded-lg bg-muted px-4 font-semibold">
            搜索同组词
          </Link>
        </div>
      </section>
    </div>
  );
}

function DetailBlock({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
      <h2 className="text-sm font-semibold text-subtle">{title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-base leading-7">{text}</p>
    </section>
  );
}

function SmallStat({ label, value }: { label: string | number; value: string | number }) {
  return (
    <div className="rounded-lg bg-surface p-3">
      <p className="text-xs text-subtle">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}
