# Category A 機能実装詳細

## TL;DR

Category A の 7 機能（日付ヘッダー・テキスト検索・日付範囲・削除・インライン編集・タグフィルタ・グローバルキャプチャ）がすべて実装済み。
フィルタ系（A2/A3/A6）は `filter-bar.ts` に集約し、書き込み系（A4/A5）は `memo-writer.ts` に集約している。

## 実装済み機能一覧

| ID  | 機能                 | ステータス | 主要ファイル                      |
| --- | -------------------- | ---------- | --------------------------------- |
| A1  | 日付グループヘッダー | 実装済み   | `scraps-view.ts`                  |
| A2  | テキスト検索         | 実装済み   | `filter-bar.ts`, `scraps-view.ts` |
| A3  | 日付範囲フィルタ     | 実装済み   | `filter-bar.ts`, `date-utils.ts`  |
| A4  | メモ削除             | 実装済み   | `memo-writer.ts`, `memo-card.ts`  |
| A5  | インライン編集       | 実装済み   | `memo-writer.ts`, `memo-card.ts`  |
| A6  | タグフィルタ         | 実装済み   | `memo-parser.ts`, `filter-bar.ts` |
| A7  | グローバルキャプチャ | 実装済み   | `capture-modal.ts`, `main.ts`     |

## A1: 日付グループヘッダー

`renderTimeline()` の memo ループ内で、前のメモと日付が異なる場合に `.scraps-date-header` div を挿入する。

```typescript
// scraps-view.ts
let lastDate = "";
for (const memo of filtered) {
  if (memo.date !== lastDate) {
    lastDate = memo.date;
    this.timelineEl.createDiv({ cls: "scraps-date-header", text: formatDateForDisplay(memo.date) });
  }
  renderMemoCard(...);
}
```

## A2: テキスト検索

`filter-bar.ts` の検索 input が `onSearchChange` コールバックを呼び出し、`scraps-view.ts` が `searchQuery` を更新して `renderTimeline()` を再実行する。
フィルタリングは `rawLines.join("\n")` の小文字照合で行う。

## A3: 日付範囲フィルタ

- 日付 from/to が両方設定されている場合、`reloadDateRange()` を呼び出し `getDateRangeBetween()` で生成した日付リストのメモのみを取得する。
- 日付範囲が設定されている間は「もっと読む」ボタンが非表示になる。
- どちらか一方でも空の場合は通常の `reload()` に戻る。

## A4: メモ削除

`MemoWriter.deleteMemo()` がメモを Daily Note から削除する。

```text
1. memo.rawLines[0] と一致する行を Daily Note 内で検索（findMemoStartLine）
2. その行から継続行を含めた行数をカウント（countMemoLines）
3. lines.splice() でその範囲を削除し vault.process() で書き戻す
```

削除前に `memo-card.ts` 内で確認ダイアログを表示する。

## A5: インライン編集

メモカードに「編集」ボタンを追加。クリックするとカード本文が CodeMirror 6 エディタに切り替わる。

- `editor-factory.ts` の共有拡張セット（Vim・リスト継続）を使用
- 保存時に `MemoWriter.updateMemo()` を呼び出し、`rawLines` の範囲を新しいテキストで置き換える
- `Esc` キーまたはキャンセルボタンで編集を破棄し、元の表示に戻る

`updateMemo()` の処理フロー：

```text
1. rawLines[0] で位置を特定（findMemoStartLine）
2. 継続行数をカウント（countMemoLines）
3. 新テキストをタイムスタンプ付き行フォーマットに変換
4. lines.splice() で置換し vault.process() で書き戻す
```

## A6: タグフィルタ

### タグ抽出（memo-parser.ts）

`extractTags()` が `/#([^\s#]+)/g` 正規表現で `rawLines` 全体からタグを抽出し、`Memo.tags` に格納する。

### タグチップ表示（filter-bar.ts）

`updateTagChips()` が全メモから集計したタグを出現頻度順に並べ、`.scraps-tag-chip` ボタンとして描画する。アクティブなタグには `.is-active` クラスが付与される。

### フィルタロジック（scraps-view.ts）

タグフィルタは **OR 条件**：`selectedTags` のいずれか 1 つ以上が `memo.tags` に含まれているメモを表示する。

## A7: グローバルキャプチャ

`main.ts` でコマンドパレット用コマンドを登録する。

```typescript
this.addCommand({
	id: "capture-scraps",
	name: "Capture scraps",
	callback: () => new CaptureModal(this.app, this.writer).open(),
});
```

`CaptureModal` は `Modal` を継承し、CodeMirror 6 エディタを表示する。
`Mod+Enter` でメモを保存し、`MemoWriter.appendMemo()` に委譲する。

## フィルタの組み合わせ動作

| フィルタ     | 適用順              | 備考                                                       |
| ------------ | ------------------- | ---------------------------------------------------------- |
| テキスト検索 | `renderTimeline` 内 | `rawLines` 全体を対象                                      |
| タグ         | `renderTimeline` 内 | OR 条件、全メモ（非フィルタ済み）からタグ集計              |
| 日付範囲     | `reloadDateRange`   | メモ取得自体を絞り込む（フィルタではなくロード範囲の変更） |

テキスト検索とタグは `renderTimeline()` 内で AND 条件として組み合わさる。
日付範囲は `memos` マップの内容自体を変える点が異なる。
