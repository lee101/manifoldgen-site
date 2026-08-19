# ManifoldGen Everywhere

Chrome MV3 extension for turning web research into polished ManifoldGen and Netwrck content.

Load `manifoldgen-site/extension/` from `chrome://extensions` with Developer mode and **Load unpacked**.

Build and verify the Chrome Web Store ZIP from the repository root:

```sh
./scripts/build-extension.sh
```

The upload-ready archive is written to `artifacts/manifoldgen-everywhere-<version>.zip`.

Actions:

- Select text: create a ManifoldGen image or video, create a Netwrck character, or make Netwrck gallery art.
- Hover or right-click an image: animate it in ManifoldGen, create a Netwrck character, or post it to the gallery.
- Image generation uses the `images3.netwrck.com` upload endpoint and hands the public result into the destination flow.
- Copy is intentionally restrained and editorial: no invented claims, logos, watermarks, or generic social filler.
