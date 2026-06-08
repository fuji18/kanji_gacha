import { mount, unmount } from 'svelte';
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
  const raw = new URLSearchParams(location.search).get('seed');
  if (raw === null) return {};
  const seed = Number(raw);
  return Number.isFinite(seed) ? { random: mulberry32(seed) } : {};
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
