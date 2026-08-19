ManifoldGen production is the same host used by the site deploy:

    ssh -o StrictHostKeyChecking=no administrator@93.127.141.100

The application checkout on production is /nvme0n1-disk/code/manifold-site.
From this checkout, ./deploy.sh builds the frontend and server, installs the
service, syncs the static site and gallery assets to the manifoldgenstatic R2
bucket, and purges the ManifoldGen Cloudflare zone. Run it after frontend,
server, gallery, or deployment-script changes. Verify both:

    curl -fsS https://manifoldgen.com/api/health
    curl -fsS 'https://manifoldgen.com/api/images?skip_total=true&varied=true&per_page=1&allow_nsfw=true'

The compact provider logo is published by that deploy at
https://manifoldgenstatic.manifoldgen.com/static/brand/logo-64.webp.
