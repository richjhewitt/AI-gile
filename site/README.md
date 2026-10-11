# aigile.lol site

Static one-page site: `index.html`, `style.css`, `assets/`. No build step, no trackers, no cookies.
Colours come from the board (`public/css/*.css`); re-copy them if the board's colours change.

## Deploy

Copy the folder contents to the web root, e.g.:

    rsync -a site/ server:/var/www/aigile-site/

When there is a download or a public repo, edit its button in `index.html`
(remove the `soon` class, `aria-disabled` and the "Coming soon" label, and set the link).

## nginx

    server {
        listen 80;
        server_name aigile.lol www.aigile.lol;
        root /var/www/aigile-site;
        index index.html;
    }

Add HTTPS with certbot (`certbot --nginx -d aigile.lol -d www.aigile.lol`).
