# アーキテクチャ概要

## TL;DR

obsidian-scraps は Obsidian の Daily Notes に記録されたタイムスタンプ付きメモを読み書きする軽量プラグイン。
コア処理（パース・書き込み）、UI コンポーネント、ユーティリティの 3 層構造で実装されている。
Category A の 7 機能実装により、フィルタバー・インライン編集・削除・グローバルキャプチャが追加された。

## モジュール構成

```text
src/
├── main.ts                  # プラグインエントリポイント（ライフサイクル・コマンド登録のみ）
├── types.ts                 # Memo / ScrapsSettings インターフェース
├── settings.ts              # 設定タブ UI
├── core/
│   ├── memo-parser.ts       # Daily Note テキスト → Memo[] 変換
│   ├── memo-writer.ts       # Memo の追加・更新・削除（Daily Note への書き込み）
│   ├── section-locator.ts   # Daily Note 内のセクション見出し検索
│   └── daily-notes.ts       # Daily Notes フォルダ設定・ファイル解決
├── ui/
│   ├── scraps-view.ts       # メインタイムラインビュー（ItemView）
│   ├── memo-card.ts         # 個別メモカード（表示・インライン編集・削除）
│   ├── memo-input.ts        # 新規メモ入力エディタ（CodeMirror 6）
│   ├── capture-modal.ts     # グローバルキャプチャモーダル（A7）
│   ├── filter-bar.ts        # フィルタバー（テキスト検索・日付範囲・タグ）
│   ├── editor-factory.ts    # CodeMirror 拡張セット共有ファクトリ
│   └── list-continuation.ts # Markdown リスト自動継続拡張
└── utils/
    └── date-utils.ts        # 日付フォーマット・範囲生成ユーティリティ
```

## データフロー

```mermaid
flowchart TD
    DN[Daily Note ファイル] -->|vault.cachedRead| Parser[memo-parser.ts\nparseMemos]
    Parser -->|Memo[]| SV[scraps-view.ts\nrenderTimeline]
    SV -->|フィルタ適用| TL[タイムライン DOM]
    TL -->|編集/削除コールバック| Writer[memo-writer.ts\nupdateMemo / deleteMemo]
    Writer -->|vault.process| DN
    MI[memo-input.ts] -->|onSubmit| Writer
    CM[capture-modal.ts] -->|submit| Writer
```

## 主要インターフェース

### Memo 型 (`src/types.ts`)

| フィールド       | 型                  | 説明                                        |
| ---------------- | ------------------- | ------------------------------------------- |
| `id`             | `string`            | `date_time` 形式の一意 ID                   |
| `date`           | `string`            | `YYYY-MM-DD` 形式                           |
| `time`           | `string`            | `HH:mm` または `HH:mm:ss`                   |
| `timeNormalized` | `string`            | ソート用に `HH:mm:ss` に正規化              |
| `content`        | `string`            | タイムスタンプを除いた本文テキスト          |
| `rawLines`       | `string[]`          | Daily Note 上の生テキスト行（削除・更新用） |
| `tags`           | `readonly string[]` | `#tag` 形式で抽出されたタグ一覧             |

### MemoCardCallbacks (`src/ui/memo-card.ts`)

| コールバック | 型                                      | 用途                   |
| ------------ | --------------------------------------- | ---------------------- |
| `onDelete`   | `(memo: Memo) => void`                  | 削除ボタン押下時       |
| `onEdit`     | `(memo: Memo, newText: string) => void` | インライン編集の保存時 |

### FilterBarCallbacks (`src/ui/filter-bar.ts`)

| コールバック        | 型                                   | 用途             |
| ------------------- | ------------------------------------ | ---------------- |
| `onSearchChange`    | `(query: string) => void`            | テキスト検索変更 |
| `onDateRangeChange` | `(from: string, to: string) => void` | 日付範囲変更     |
| `onTagToggle`       | `(tag: string) => void`              | タグ選択切替     |

## 設計上の決定事項

| 項目                       | 決定                                       | 理由                                                     |
| -------------------------- | ------------------------------------------ | -------------------------------------------------------- |
| メモ位置特定（削除・更新） | タイムスタンプ再検索（`rawLines[0]` 照合） | `Memo` 型に行番号を持たせず、外部編集への耐性を確保      |
| インライン編集 UI          | CodeMirror 6（Vim モード・リスト継続有効） | memo-input と同じ編集体験をタイムライン内でも実現        |
| フィルタバー配置           | 入力欄とタイムラインの間                   | 入力 → フィルタ → タイムラインの自然な上下の流れ         |
| 日付範囲と「もっと読む」   | 独立して共存                               | 範囲未設定時は「もっと読む」が通常動作、設定時は非表示   |
| CodeMirror 拡張の共有      | `editor-factory.ts` で一元管理             | `memo-input` と `capture-modal` で同一拡張セットを再利用 |
| タグ抽出                   | `parseMemos` 内で `extractTags` を呼び出す | Memo 型構築時に一度だけ処理し、以降は `memo.tags` を参照 |
