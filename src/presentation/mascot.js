/* PharmaAnalytics — login mascot (presentation layer only: no storage, no business rules).
 *
 * A real game of PEEKABOO. When the cursor moves onto the axolotl she plays this little story
 * (about 3.5 seconds), then stays waving until the cursor leaves:
 *
 *   1. she ducks BEHIND THE WALL (the seam between the purple panel and the form)
 *   2. she peeks out shyly with her hands over her eyes            -> CloseEyes
 *   3. peeks out a little further… then ducks back (suspense)
 *   4. BOO! she pops out laughing                                   -> Smirk
 *   5. she waves hello (a smooth cross-fade, no jump)               -> Waving
 *
 * When the cursor leaves she ducks behind the wall once more and comes back as Peeking.
 * Clicking her replays the game. She also pops in once when the page opens.
 *
 * Lives only on the login / first-time-setup / workspace-choice screens (#login).
 * It re-attaches itself whenever that screen is redrawn.
 *
 * How it moves: mascot.js only sets three CSS variables on .mascot (--slide, --dur, --ease) and
 * toggles .tucked / .xfade; styles.css does the actual drawing and easing.
 */
(function () {
  'use strict';

  var BASE = 'assets/';
  var FILES = { waving: 'Waving.png', smirk: 'Smirk.png', closeeyes: 'CloseEyes.png' };
  var REST = 'peeking';                       // resting pose = the default picture in styles.css

  // How far she is slid to the right, in % of the picture width.
  var HIDDEN = 36;                            // completely behind the wall
  var SHY    = 12;                            // just her gills and bow showing
  var BOLD   = 3;                             // nearly all the way out (still covering her eyes)

  var IN   = 'cubic-bezier(.55,.05,.85,.4)';  // speeds up as she ducks behind the wall
  var OUT  = 'cubic-bezier(.16,.84,.3,1)';    // slows down as she pops out
  var SOFT = 'cubic-bezier(.45,0,.25,1)';     // gentle in-and-out

  var RESET_MS = 700;                         // wait after the cursor leaves, then she goes back to Peeking
  var INTRO_MS = 450;                         // pause before the first pop-in when the page opens

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var introPlayed = false;

  // Preload every picture so nothing flashes. A picture that fails to load (wrong name / missing
  // file) is skipped by the story instead of leaving a blank mascot.
  var loaded = {};
  Object.keys(FILES).forEach(function (id) {
    var img = new Image();
    img.onload = function () { loaded[id] = true; };
    img.src = BASE + FILES[id];
  });
  function has(id) { return !!loaded[id]; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function attach(mascot) {
    // Invisible hover area around the character only. It is a child of the (stationary) box,
    // not of the picture that slides, so the cursor never "loses" her mid-animation.
    var hit = document.createElement('div');
    hit.className = 'mascot-hit';
    mascot.appendChild(hit);
    mascot.setAttribute('data-pose', REST);

    var current = REST, running = false, want = null, lastKind = null, leaveTimer = null, cycle = -1;

    /* ---------- tiny building blocks ---------- */
    function slide(pct, ms, ease) {
      var st = mascot.style;
      st.setProperty('--dur', ms + 'ms');
      st.setProperty('--ease', ease || OUT);
      st.setProperty('--slide', pct + '%');
    }
    function tuck(on) { mascot.classList.toggle('tucked', on); }   // on = cut everything right of the wall
    function setPose(id) {
      current = id;
      mascot.setAttribute('data-pose', id);
      mascot.removeAttribute('data-next');
    }
    async function fadeTo(id) {                                    // smooth cross-fade while she is visible
      if (id === current) return;
      mascot.setAttribute('data-next', id);
      mascot.classList.add('xfade');
      await sleep(260);
      mascot.classList.add('noxfade');
      setPose(id);
      mascot.classList.remove('xfade');
      void mascot.offsetWidth;                                     // apply without animating the reset
      mascot.classList.remove('noxfade');
    }
    async function duck(ms) {                                      // slide behind the wall
      tuck(true);
      slide(HIDDEN, ms, IN);
      await sleep(ms);
    }
    async function popOut(ms) {                                    // slide back out and grab the wall edge
      slide(0, ms, OUT);
      await sleep(Math.max(ms - 170, 0));
      tuck(false);                                                 // wall opens just as her hands arrive
      await sleep(230);
    }

    /* ---------- the acts ---------- */
    async function intro() {                                       // once, when the page opens
      lastKind = 'intro';
      slide(HIDDEN, 0, IN);                                        // start already hidden (no animation)
      tuck(true);
      await sleep(INTRO_MS);
      await popOut(520);
    }

    async function story() {                                       // the full peekaboo game
      lastKind = 'story';
      await duck(300);
      await sleep(80);
      if (has('closeeyes')) {
        setPose('closeeyes');                                      // swapped while she is out of sight
        await sleep(140);
        slide(SHY, 420, OUT);                                      // shy little peek...
        await sleep(420 + 380);
        slide(BOLD, 280, SOFT);                                    // ...a bit further...
        await sleep(280 + 220);
        await duck(240);                                           // ...and ducks back (suspense)
        await sleep(170);
      }
      setPose(has('smirk') ? 'smirk' : (has('waving') ? 'waving' : REST));
      await sleep(100);
      await popOut(380);                                           // BOO!
      if (has('smirk') && has('waving')) {
        await sleep(900);
        await fadeTo('waving');                                    // wave hello
      }
    }

    async function rest() {                                        // cursor left: duck, return to Peeking
      if (current === REST) return;
      lastKind = 'rest';
      await duck(260);
      await sleep(80);
      setPose(REST);
      await sleep(110);
      await popOut(400);
    }

    /* ---------- one act at a time; the latest request wins ---------- */
    async function loop() {
      running = true;
      while (want) {
        var k = want; want = null;
        try {
          if (k === 'intro') await intro();
          else if (k === 'story') await story();
          else await rest();
        } catch (e) { /* the login was redrawn mid-animation; nothing to do */ }
      }
      running = false;
    }
    function request(kind) { want = kind; if (!running) loop(); }

    /* ---------- cursor ---------- */
    hit.addEventListener('mouseenter', function () {
      clearTimeout(leaveTimer);
      if (reduceMotion) {                                          // no motion: just change picture
        var list = Object.keys(FILES).filter(has);
        if (list.length) { cycle = (cycle + 1) % list.length; setPose(list[cycle]); }
        return;
      }
      if (lastKind !== 'story') request('story');
    });
    hit.addEventListener('mouseleave', function () {
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(function () {
        if (reduceMotion) { setPose(REST); return; }
        if (lastKind === 'story' || want === 'story') request('rest');
      }, RESET_MS);
    });
    hit.addEventListener('click', function () {
      if (reduceMotion || running) return;
      clearTimeout(leaveTimer);
      request('story');
    });

    // She pops in once per page load.
    if (!introPlayed) {
      introPlayed = true;
      if (!reduceMotion) request('intro');
    }
  }

  function ensure() {
    var login = document.getElementById('login');
    if (!login) return;
    var mascot = login.querySelector('.mascot');
    if (!mascot) {
      mascot = document.createElement('div');
      mascot.className = 'mascot';
      mascot.setAttribute('aria-hidden', 'true');
      login.appendChild(mascot);
    }
    if (!mascot.querySelector('.mascot-hit')) attach(mascot);
  }

  function start() {
    ensure();
    new MutationObserver(ensure).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
