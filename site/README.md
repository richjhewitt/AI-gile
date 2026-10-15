# aigile.lol site

Static one-page site: `index.html`, `style.css`, `teaser.js`, `timeline.js` + `timeline.json`, `i18n.js` + `lang/` (every language: see `lang/TRANSLATE.md`), `assets/`. No trackers, no cookies.
After editing a `lang/*.json` file run `node tools/gen/site-lang.mjs`, then `node tools/site-i18n-check.mjs`.
Colours come from the board (`public/css/*.css`); re-copy them if the board's colours change.

## Deploy

Copy the folder to the server, then run the installer there (nginx site + certbot; safe to re-run to update):

    sudo bash install-site.sh test.aigile.lol
    sudo bash install-site.sh aigile.lol www.aigile.lol

When there is a download or a public repo, edit its button in `index.html`
(remove the `soon` class, `aria-disabled` and the "Coming soon" label, and set the link).

## Private test site (AIG-699)

Only browsers with a test site pass get in; everyone else goes to the teaser. Needs the join service on the server.

    sudo bash install-site.sh --private https://aigile.lol test.aigile.lol

Make a pass on the board: Setup → Invite a friend → 🌐 Make a test site pass. Run again without --private to open the site up.

## nginx

    server {
        listen 80;
        server_name aigile.lol www.aigile.lol;
        root /var/www/aigile-site;
        index index.html;
    }

Add HTTPS with certbot (`certbot --nginx -d aigile.lol -d www.aigile.lol`).
