# React に関するルールや考え方

## コンポーネント

- React コンポーネントは named function で宣言する（`export default function ComponentName() {}`）

## ライフサイクル

- `useEffect` で登録したイベントリスナーやタイマー、開始した非同期処理は、cleanup 関数で解放・中断する
