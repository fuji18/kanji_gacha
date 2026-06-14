import { mount, unmount } from 'svelte';
import './ui/styles/material-tokens.css';
import App from './App.svelte';
import LoadingView from './ui/components/LoadingView.svelte';
import ErrorView from './ui/components/ErrorView.svelte';
import { DictionaryRepository } from './data/DictionaryRepository';
import { StorageRepository } from './data/StorageRepository';
import {
  SessionManager,
  type SessionManagerOptions,
} from './app/SessionManager';
import { mulberry32 } from './domain/rng/mulberry32';

/**
 * `?seed=<整数>` が付いていればフリープレイの乱数を決定化する（再現・E2E 用の無害なレバー）。
 * デイリーは元から日付シードで決定的なため対象外。
 */
function sessionOptionsFromUrl(): SessionManagerOptions {
  const params = new URLSearchParams(location.search);
  const opts: SessionManagerOptions = {};

  const rawSeed = params.get('seed');
  if (rawSeed !== null) {
    const seed = Number(rawSeed);
    if (Number.isFinite(seed)) opts.random = mulberry32(seed);
  }

  // `?taMs=<整数>` でタイムアタックの初期持ち時間を上書きする（E2E 短縮用の無害なレバー・T-027）。
  const rawTaMs = params.get('taMs');
  if (rawTaMs !== null) {
    const taMs = Number(rawTaMs);
    if (Number.isFinite(taMs) && taMs > 0) opts.timeAttackInitialMs = taMs;
  }

  // `?deckMax=<整数>` で達成型（deck）の山札枚数を上限する（E2E 短縮用の無害なレバー）。
  const rawDeckMax = params.get('deckMax');
  if (rawDeckMax !== null) {
    const deckMax = Number(rawDeckMax);
    if (Number.isFinite(deckMax) && deckMax > 0) opts.deckLimit = deckMax;
  }

  return opts;
}

// エントリポイント（T-015）。辞書ロードを待ってから App をマウントする。
// ロード中はローディング、失敗時は再読み込み導線付きのエラーUIを表示してマウントを中断する（機能設計11）。
const target = document.getElementById('app');
if (target === null) {
  throw new Error('マウント先 #app が見つかりません');
}

const loading = mount(LoadingView, { target });

const dict = new DictionaryRepository();
const storage = new StorageRepository();

void dict
  .load()
  .then(() => {
    unmount(loading);
    const sessionManager = new SessionManager(
      dict,
      storage,
      sessionOptionsFromUrl()
    );
    mount(App, { target, props: { sessionManager } });
  })
  .catch((err: unknown) => {
    unmount(loading);
    mount(ErrorView, {
      target,
      props: {
        title: 'データの読み込みに失敗しました',
        message: '通信環境を確認して、再読み込みしてください。',
        onRetry: () => location.reload(),
      },
    });
    // 原因はコンソールに残す（KPI送信なし・ローカル完結）
    console.error(err);
  });
