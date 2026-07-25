# ４次元多胞体ビューワー

[English version is here](README.md)

これは TypeScript と three.js で書かれた４次元多胞体ビューワーです。４次元凸一様多胞体のほとんどを表示し、回転させることができます。

[![A screenshot](img/screenshot.jpeg "A screenshot")](https://youtu.be/hjcY2zeuUDM)

## 始めよう

1. [アプリを開く](https://satshi.github.io/app/)
2. 「View」ボタンを押す

すると、回転している４次元立方体が見られます。

## 次に

### 操作

「Control」にあるボタンで操作モードを切り替えられます。

* Auto: 自動的に回ります。
* Stop: 静止します。
* 3D move: マウスのドラッグで３次元空間内で回転できます。
* 4D move: マウスのドラッグで４次元空間内で回転できます。

### 別の多胞体

1. 左のドロップダウンリストから、多胞体のクラスを選びます。
2. 右のドロップダウンリストから、多胞体を選びます。
3. 「View」ボタンを押します。

すると、選んだ多胞体が見られます。

### フレーム表示

「Frame」にチェックを入れて「View」ボタンを押すと、各面の枠を表示するフレーム表示になります。

## 多胞体について
Wikipedia のページ [Uniform 4-polytope](https://en.wikipedia.org/wiki/Uniform_4-polytope) に詳しい説明があります。このアプリで "**-cell series" に分類される多胞体の名前は Coxeter 図に基づいています。 このアプリでは、0 は Coxeter 図の ● に対応し、1 は ◉ に対応します。つまり、例えば 0101 は Coxeter 図 ●－◉－●－◉ に対応します。 このアプリの "Snub" は ◯－◯－◯－◯ に対応します。


## その他の情報

[多胞体の JSON フォーマット](format.md)

## 開発

Node.js 20.19 以降と pnpm 11.9.0 が必要です。

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

開発サーバーを起動すると、開くURLが表示されます。その他のコマンド:

```sh
# dist/ に本番用ファイルを生成
pnpm build

# 型チェック、ビルド、全テストを実行
pnpm check

# 本番用ビルドをプレビュー
