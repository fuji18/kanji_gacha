import { mount } from 'svelte';
import App from './App.svelte';

// scaffold時点のエントリポイント。辞書ロード→マウントの本実装は T-015 で行う。
const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
