import Link from "next/link";
import { ArrowLeft, BookOpen, CheckCircle2, ChevronRight, Database, Info } from "lucide-react";
import { OFFICIAL_CLEAN_WORD_COUNT, PUBLIC_VOCAB_INTERNAL_LABEL, PUBLIC_VOCAB_NAME } from "@/lib/vocab";

const appVersion = "1.0 正式版";

const infoItems = [
  { label: "App 版本", value: appVersion },
  { label: "当前词库", value: PUBLIC_VOCAB_NAME },
  { label: "当前词数", value: String(OFFICIAL_CLEAN_WORD_COUNT) },
];

export default function AboutWordSprintPage() {
  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <header className="flex items-center gap-3">
        <Link
          className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-panel text-ink hover:border-brand"
          href="/settings"
          aria-label="返回设置"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <p className="text-sm font-semibold text-brand">Settings</p>
          <h1 className="text-2xl font-bold text-ink">关于 WordSprint</h1>
        </div>
      </header>

      <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
        <p className="text-sm font-semibold text-brand">WordSprint</p>
        <h2 className="mt-2 text-3xl font-bold text-ink">Learn it fast. Make it last.</h2>
        <p className="mt-4 text-sm leading-7 text-subtle">
          WordSprint 是一个面向考研英语词汇的快速练习应用，帮助用户通过 Practice、Exam、Review 和 Mistakes 完成背词、测试、复习和错题巩固。
        </p>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <div className="flex items-center gap-2">
          <Info className="text-brand" size={18} />
          <h2 className="font-bold text-ink">版本与词库</h2>
        </div>
        <div className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line">
          {infoItems.map((item) => (
            <div key={item.label} className="flex items-start justify-between gap-4 bg-surface px-3 py-3">
              <span className="text-sm text-subtle">{item.label}</span>
              <span className="max-w-[60%] text-right text-sm font-semibold text-ink">{item.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <div className="flex items-center gap-2">
          <Database className="text-brand" size={18} />
          <h2 className="font-bold text-ink">数据说明</h2>
        </div>
        <p className="mt-3 text-sm leading-7 text-subtle">
          学习记录目前保存在本地设备中。可以在“学习数据 / 备份”中导出、导入或清空学习记录。
        </p>
        <Link className="mt-4 flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-3 text-sm font-semibold text-ink hover:border-brand" href="/settings/data">
          <span>前往学习数据 / 备份</span>
          <ChevronRight size={17} className="text-subtle" />
        </Link>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <div className="flex items-center gap-2">
          <BookOpen className="text-brand" size={18} />
          <h2 className="font-bold text-ink">学习方式</h2>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {["Practice 即时反馈", "Exam 正式测试", "Review 到期复习", "Mistakes 错题巩固"].map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-3 text-sm font-semibold text-ink">
              <CheckCircle2 className="text-positive" size={16} />
              {item}
            </div>
          ))}
        </div>
      </section>

      <details className="rounded-lg border border-line bg-panel p-4 shadow-soft md:p-5">
        <summary className="cursor-pointer font-bold text-ink">技术信息</summary>
        <div className="mt-3 space-y-2 text-sm text-subtle">
          <p>内部版本：{PUBLIC_VOCAB_INTERNAL_LABEL}</p>
          <p>buildMode: {process.env.NODE_ENV}</p>
        </div>
      </details>

      <p className="text-center text-sm font-semibold text-subtle">Made for vocabulary sprint learning.</p>
      <p className="pb-2 text-center text-xs text-subtle">
        意见与反馈：
        <a className="font-medium text-subtle underline-offset-4 hover:text-brand hover:underline" href="mailto:3172456681@qq.com">
          3172456681@qq.com
        </a>
      </p>
    </div>
  );
}
