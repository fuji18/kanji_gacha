/**
 * 読み上げユーティリティ（T-032）。ブラウザ内蔵の Web Speech API（`speechSynthesis`）で
 * 日本語を発話する。外部送信なし・ローカル完結（CSP/プライバシー配慮）。非対応環境では no-op。
 */

/** この環境で読み上げが使えるか（SSR/未対応ブラウザでは false）。 */
export function canSpeak(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  );
}

/** テキストを日本語で発話する（前の発話はキャンセル）。非対応・空文字は何もしない。 */
export function speak(text: string, lang = 'ja-JP'): void {
  if (!canSpeak() || text.trim() === '') return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  // 連打時に重ならないよう直前の発話を止めてから話す。
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
