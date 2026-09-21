# Editing the site

The site is one HTML page, but its text and lists no longer live inside that
file. They live in `content/`, and a build step assembles the page from them.

```
content/site.en.json      English text, grouped by section
content/site.fr.json      French
content/site.ar.json      Arabic
content/gallery.json      gallery photos (full image, thumbnail, alt text)
content/clients.json      client and partner logos
content/contact.json      phone, WhatsApp and email — used everywhere they appear
index.template.html       the page itself — markup, CSS, scripts
scripts/build.mjs         assembles dist/index.html from the above
```

## How a change reaches the site

1. You save an edit in the CMS.
2. The CMS commits the changed JSON to `main`.
3. GitHub Actions runs `node scripts/build.mjs` and publishes `dist/`.

Roughly a minute end to end. Nothing is committed back to the repository by the
workflow — `dist/` is built fresh each time and uploaded straight to Pages.

## Connecting the CMS

`.pages.yml` is the configuration for [Pages CMS](https://pagescms.org). To
start editing:

1. Sign in at https://app.pagescms.org with the GitHub account that owns this
   repository.
2. Select the repository and the `main` branch.
3. Grant the app access when prompted.

The forms are generated from `.pages.yml`: one entry per language, plus Gallery
and Clients. Uploaded images land in `images/gallery` or `assets/img`.

If you would rather not give a third-party app write access, the alternative is
[Sveltia CMS](https://github.com/sveltia/sveltia-cms) served from an `/admin`
folder in this repository, with the
[`sveltia-cms-auth`](https://github.com/sveltia/sveltia-cms-auth) Worker
deployed to the same Cloudflare account that already runs certificate
verification. Content files stay exactly as they are — only the editing UI
changes.

## Working locally

```bash
node scripts/build.mjs          # writes dist/
cd dist && python3 -m http.server 8000
```

The build refuses to run and prints what is wrong if a translation key is
missing from French or Arabic, if the template refers to a key that no longer
exists, or if a gallery photo or logo points at a file that is not in the
repository. That check is the reason a bad edit fails in Actions instead of
reaching the live site.

## Contact details

Phone, WhatsApp and email are set once in `content/contact.json` and written
into every place they appear: the contact section, the footer, the WhatsApp
button, the booking form's email link, the search-engine metadata, and the
"opens your email to…" note in all three languages.

Enter numbers the way they should be displayed (`+222 48 15 63 30`). The call
link and the `wa.me` link are built from the digits, so spacing does not
matter. The build rejects a number with fewer than 8 digits or a malformed
email address, so a typo fails in Actions rather than reaching the site.

In templates and translations, use `{{phone}}`, `{{phone_link}}`,
`{{whatsapp_link}}` or `{{email}}` instead of writing the value out.

## Adding new text

Text is keyed. To add a line to the page:

1. Add the key to all three files in `content/` under the right section.
2. Reference it in `index.template.html` as `data-i18n="section.key"`.

At build time the English value is written into the markup, so the shipped page
is readable before any JavaScript runs. French and Arabic are swapped in at
runtime by the language switcher.

## Two things to keep an eye on

**Image weight.** The CMS uploads images exactly as given. The gallery is
served as 480px thumbnails with the full image loaded only when a visitor opens
the lightbox, and that split is done by hand. A photo uploaded straight from a
phone will be several megabytes and will be served at that size. Either resize
before uploading, or add a compression step to the workflow.

**Certificate data.** `worker.js` still contains the certificate records in
plain text in this public repository. That is unrelated to the CMS, and it
should be moved to Workers KV or a private repository before this goes to
production.
