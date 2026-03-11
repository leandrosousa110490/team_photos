# EdgeFrame Photography Studio (Multi-Page Static Site)

A fully static, highly interactive photography website for weddings, parties, family, kids, corporate events, and sports coverage, built with plain HTML, CSS, and JavaScript.

## Pages

- `index.html` - Dynamic homepage with animated hero canvas, live pulse feed, spotlight carousel, and counters
- `gallery.html` - Filter + search gallery, grid/dense view toggle, lightbox, and story reel cards
- `services.html` - Interactive package tabs, clickable production workflow, and add-on calculator
- `results.html` - Animated metrics, engagement trend canvas chart, testimonial carousel, and venue profile switcher
- `book.html` - Live booking estimator, month-based availability indicator, and interactive FAQ accordion

## Shared Assets

- `styles.css` - Global visual system, gradients, glass surfaces, responsive layout, and motion styling
- `app.js` - Shared UI behavior plus page-specific interactive modules

## Local Run

```bash
python -m http.server 8080
```

Visit `http://localhost:8080`.

## GitHub Pages Deploy

1. Push this repo to GitHub.
2. Go to **Settings -> Pages**.
3. Choose **Deploy from a branch**.
4. Select `main` and folder `/ (root)`.
5. Save and wait for publish.

Site URL format:

`https://<your-username>.github.io/<repository-name>/`
