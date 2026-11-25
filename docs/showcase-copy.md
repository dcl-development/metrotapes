# Case-study copy for jakedcl.com/work/metrotapes

Paste-ready text for the portfolio page. Edit the bracketed parts to match what you actually did.

**Title:** metrotapes

**One-liner:** A portfolio for photographer and videographer Ronnie Foreman, built as a 3D subway station you move through in the browser.

**Role:** [Design and development. Edit to match what you did.]

**Intro:** The navigation is a subway station. A kiosk on the platform is the menu, and choosing Photo, Video or About moves the camera to a screen on the station wall. The three route colors, blue, green and brown, carry through the header, the kiosk and the wall signs.

**Highlights**
- Photo, video and about are camera shots in a React Three Fiber scene. The pages on the walls are real HTML, so they stay sharp and accessible.
- No 3D model files: the platform is built from primitives, and the tile, grime and concrete textures are painted procedurally at load.
- If WebGL is unavailable or crashes, the same pages render flat. Direct links and reduced-motion settings skip the intro.
- Graphics quality tiers start from the device's capabilities, adjust to measured frame rate, and never step back up mid-session.
- The scene renders continuously only while the camera is moving, and stops on hidden tabs and wall pages to save GPU work.
- Sanity content and a YouTube playlist are served through the site's own API routes, with CDN caching and no secrets in the browser bundle.

**How it was made:** Built with AI coding agents from [your] design direction, and made procedurally in code instead of modeled in Blender.

**Built with:** Vite, React, React Router, Three.js, React Three Fiber, styled-components, Sanity and Vercel.

**Images, in this order:** `docs/img/kiosk.jpg`, `photo.jpg`, `video.jpg`, `about.jpg`, `phone-kiosk.jpg`. Add a 10-second screen recording of the kiosk-to-wall camera move if you can.

**Changes from the live page:**
- Remove "and the blog uses a normal page layout". The blog no longer exists in the repo.
- Use one spelling of the name everywhere: `metrotapes`.
- Fill the second row of thumbnails (it currently leaves an empty slot).
