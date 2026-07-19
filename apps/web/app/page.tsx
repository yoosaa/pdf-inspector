"use client";

import { ChangeEvent, FormEvent, useState } from "react";

import type { PdfAnalysisResult } from "@/app/_types/pdf";

const MAX_FILE_SIZE = 4 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<PdfAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;

    setError(null);
    setResult(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (selectedFile.type !== "application/pdf") {
      setFile(null);
      setError("PDFファイルを選択してください。");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setError("ファイルサイズは4MB以下にしてください。");
      return;
    }

    setFile(selectedFile);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file) {
      setError("PDFファイルを選択してください。");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

      const response = await fetch(`${apiBaseUrl}/api/analyze`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail ?? "PDFの解析に失敗しました。");
      }

      setResult(data);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "PDFの解析中にエラーが発生しました。"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <header className="mb-10">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-600">
            PDF Inspector
          </p>

          <h1 className="text-4xl font-bold tracking-tight">
            PDFの構造を手軽に確認
          </h1>

          <p className="mt-4 max-w-2xl text-slate-600">
            PDFをアップロードすると、ページ数、メタデータ、文字数、
            ページごとのテキスト有無を解析します。
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block rounded-xl border-2 border-dashed border-slate-300 p-8 text-center">
              <span className="block text-lg font-semibold">
                PDFファイルを選択
              </span>

              <span className="mt-2 block text-sm text-slate-500">
                最大4MB・ファイルは保存されません
              </span>

              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="mt-4 block w-full text-sm"
              />
            </label>

            {file && (
              <p className="text-sm text-slate-600">
                選択中: {file.name}（{formatFileSize(file.size)}）
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!file || isLoading}
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "解析中..." : "PDFを解析する"}
            </button>
          </form>
        </section>

        {result && (
          <section className="mt-8 space-y-6">
            {result.encrypted && (
              <div className="rounded-xl bg-amber-50 p-5 text-amber-800">
                このPDFは暗号化されているため、内容を解析できませんでした。
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryCard
                label="ページ数"
                value={`${result.pageCount}ページ`}
              />
              <SummaryCard
                label="総文字数"
                value={`${result.text.totalCharacters.toLocaleString()}文字`}
              />
              <SummaryCard
                label="ファイルサイズ"
                value={formatFileSize(result.fileSize)}
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">メタデータ</h2>

              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <MetadataItem label="ファイル名" value={result.filename} />
                <MetadataItem label="タイトル" value={result.metadata.title} />
                <MetadataItem label="作成者" value={result.metadata.author} />
                <MetadataItem
                  label="作成ソフト"
                  value={result.metadata.creator}
                />
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">テキストプレビュー</h2>

              {result.text.preview ? (
                <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-100 p-4 text-sm leading-6">
                  {result.text.preview}
                </pre>
              ) : (
                <p className="mt-4 text-slate-500">
                  テキストを抽出できませんでした。スキャンされたPDFには対応していません。
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">ページ別テキスト量</h2>

              <div className="mt-4 divide-y divide-slate-200">
                {result.pages.map((page) => (
                  <div
                    key={page.pageNumber}
                    className="flex items-center justify-between py-3"
                  >
                    <span>{page.pageNumber}ページ目</span>

                    <span
                      className={
                        page.hasText ? "text-slate-700" : "text-amber-600"
                      }
                    >
                      {page.hasText
                        ? `${page.characters.toLocaleString()}文字`
                        : "テキスト未検出"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

type SummaryCardProps = {
  label: string;
  value: string;
};

function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

type MetadataItemProps = {
  label: string;
  value: string | null;
};

function MetadataItem({ label, value }: MetadataItemProps) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium">{value || "未設定"}</dd>
    </div>
  );
}
