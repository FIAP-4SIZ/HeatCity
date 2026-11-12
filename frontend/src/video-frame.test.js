import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaTimeForCapture } from './video-frame.js';
test('live capture uses the decoded frame timestamp instead of the advancing playback clock', async () => {
  const video = {
    paused: false,
    currentTime: 6.02,
    requestVideoFrameCallback(callback) {
      queueMicrotask(() => callback(0, { mediaTime: 5.9166666667 }));
      return 1;
    },
  };
  assert.equal(await mediaTimeForCapture(video), 5.9166666667);
});
test('paused review keeps the existing frame without waiting for a frame that cannot arrive', async () => {
  assert.equal(
    await mediaTimeForCapture({
      paused: true,
      currentTime: 4.5,
      requestVideoFrameCallback() {
        throw Error('Não deve aguardar');
      },
    }),
    4.5,
  );
});
test('a stalled decoded frame request times out and is cancelled', async () => {
  let cancelled = null;
  const video = {
    paused: false,
    currentTime: 0,
    requestVideoFrameCallback() {
      return 7;
    },
    cancelVideoFrameCallback(id) {
      cancelled = id;
    },
  };
  await assert.rejects(mediaTimeForCapture(video, 5), /Nenhum novo quadro/);
  assert.equal(cancelled, 7);
});
