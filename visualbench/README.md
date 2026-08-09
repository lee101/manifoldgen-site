# Studio visual benchmark

These captures exercise the real responsive `/studio` UI with a local generated video and deterministic API fixtures.

Run the frontend on port 3218, then:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome node visualbench/capture-studio.cjs
```

The benchmark writes desktop and mobile workspace/audio screenshots plus desktop/mobile Real-ESRGAN price-preview captures into this directory.
