// A real browser-generated video track with explicitly simulated hardware limits.
// This bounds test CPU cost while production still requests the camera's maximums.
export async function installTestCamera(page) {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const video = constraints.video
        ? {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
            ...(constraints.video.deviceId ? { deviceId: constraints.video.deviceId } : {}),
          }
        : false;
      const stream = await original({ video, audio: false });
      for (const track of stream.getVideoTracks()) {
        const caps = track.getCapabilities?.bind(track);
        track.getCapabilities = () => ({
          ...caps?.(),
          width: { min: 1280, max: 1280 },
          height: { min: 720, max: 720 },
          frameRate: { min: 30, max: 30 },
        });
      }
      return stream;
    };
  });
}
