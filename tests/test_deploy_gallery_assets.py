import re
from pathlib import Path


DEPLOY_SCRIPT = Path(__file__).resolve().parents[1] / "deploy.sh"


def test_gallery_originals_are_synced_without_deleting_other_writers_assets():
    script = DEPLOY_SCRIPT.read_text()

    gallery_sync = re.search(
        r'sync_asset_tree "\$GALLERY_IMAGES_DIR/originals" "gallery/originals" \\\n'
        r'\s+"public, max-age=31536000, immutable" gallery-originals (\w+)',
        script,
    )

    assert gallery_sync is not None
    assert gallery_sync.group(1) == "additive"
    assert 'if [ "$sync_mode" = "mirror" ]; then\n    sync_delete=(--delete)' in script
