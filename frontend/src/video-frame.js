// Read the decoded frame's media clock, rather than the player's advancing clock.
export async function mediaTimeForCapture(video, timeoutMs = 3000) {
  if (video.paused || typeof video.requestVideoFrameCallback !== 'function')
    return video.currentTime;
  return new Promise((resolve, reject) => {
    let handle;
    const timer = setTimeout(() => {
      video.cancelVideoFrameCallback?.(handle);
      reject(
        new Error('Nenhum novo quadro decodificado chegou da fonte. Pause e tente novamente.'),
      );
    }, timeoutMs);
    handle = video.requestVideoFrameCallback((_, metadata) => {
      clearTimeout(timer);
      resolve(metadata.mediaTime);
    });
  });
}
