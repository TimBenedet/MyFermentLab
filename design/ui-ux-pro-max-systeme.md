# Système de design proposé par la base ui-ux-pro-max

Requête : « fermentation monitoring dashboard laboratory instrument dense data »
Dials : variance 6/10 (équilibré) · motion 3/10 (subtil) · density 8/10 (dense)
Recherche faite le 28 septembre 2026 sur la base locale installée.

```
╔═════════════════════════════════════════════════════════════════════════════════════════╗
║  TARGET: Hakko - RECOMMENDED DESIGN SYSTEM                                              ║
╚═════════════════════════════════════════════════════════════════════════════════════════╝
┌─────────────────────────────────────────────────────────────────────────────────────────┐
├─── DESIGN DIALS ────────────────────────────────────────────────────────────────────────┤
│  Variance: 6/10 — Balanced / Modern                                                     │
│  Motion:   3/10 — Subtle                                                                │
│  Density:  8/10 — Dense / Dashboard                                                     │
├─── PATTERN ─────────────────────────────────────────────────────────────────────────────┤
│  Name: Real-Time / Operations Landing                                                   │
│     Conversion: Offer a demo or sandbox and show trust signals. Label telemetry as      │
│     live only when backed by a current source, with update time and stale state.        │
│     Provide pause/hide or update-frequency controls for tickers and previews, stop      │
│     offscreen/hidden work, support keyboard controls, and render a static final         │
│     snapshot under reduced motion.                                                      │
│     CTA: Primary CTA in nav + After metrics                                             │
│     Sections:                                                                           │
│       1. Hero (product + live preview or status)                                        │
│       2. Key metrics/indicators                                                         │
│       3. How it works                                                                   │
│       4. CTA (Start trial / Contact)                                                    │
├─── STYLE ───────────────────────────────────────────────────────────────────────────────┤
│  Name: Dark Mode (OLED)                                                                 │
│     Mode Support: Light not-recommended | Dark supported                                │
│     Keywords: Dark theme, low light, high contrast, deep black, midnight blue,          │
│     eye-friendly, OLED, night mode, power efficient                                     │
│     Best For: Night-mode apps, coding platforms, entertainment, eye-strain prevention,  │
│     OLED devices, low-light                                                             │
│     Performance: cost:low|drivers:none | Accessibility:                                 │
│     risk:low|requires:contrast-text-4.5,keyboard,visible-focus,reduced-motion           │
├─── COLORS ──────────────────────────────────────────────────────────────────────────────┤
│     Primary:           #16A34A    (--color-primary)                                     │
│     On Primary:        #000000    (--color-on-primary)                                  │
│     Secondary:         #22C55E    (--color-secondary)                                   │
│     On Secondary:      #0F172A    (--color-on-secondary)                                │
│     Accent/CTA:        #DC2626    (--color-accent)                                      │
│     On Accent/CTA:     #FFFFFF    (--color-on-accent)                                   │
│     Background:        #0F172A    (--color-background)                                  │
│     Foreground:        #F8FAFC    (--color-foreground)                                  │
│     Card:              #111827    (--color-card)                                        │
│     Card Foreground:   #F8FAFC    (--color-card-foreground)                             │
│     Muted:             #1E293B    (--color-muted)                                       │
│     Muted Foreground:  #CBD5E1    (--color-muted-foreground)                            │
│     Border:            #334155    (--color-border)                                      │
│     Destructive:       #DC2626    (--color-destructive)                                 │
│     On Destructive:    #FFFFFF    (--color-on-destructive)                              │
│     Ring:              #16A34A    (--color-ring)                                        │
│     Notes: Operational green + incident red + maintenance amber                         │
├─── TYPOGRAPHY ──────────────────────────────────────────────────────────────────────────┤
│  Fira Code / Fira Sans                                                                  │
│     Mood: dashboard, data, analytics, code, technical, precise                          │
│     Best For: Dashboards, analytics, data visualization, admin panels                   │
│     Google Fonts:                                                                       │
│     https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fir  │
│     a+Sans:wght@300;400;500;600;700&display=swap                                        │
│     CSS Import: @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wgh...  │
├─── KEY EFFECTS ─────────────────────────────────────────────────────────────────────────┤
│     Minimal glow (text-shadow: 0 0 10px), dark-to-light transitions, low white          │
│     emission, high readability, visible focus                                           │
├─── MOTION ──────────────────────────────────────────────────────────────────────────────┤
│  Scroll Reveal (Subtle)                                                                 │
│     Trigger: scroll (viewport enter) | Duration: 300-400ms | Easing: power1.out         │
│     GSAP: gsap.from(el, { opacity: 0, y: 12, duration: 0.35, ease: 'power1.out',        │
│     scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none      │
│     reverse' } });                                                                      │
│     Framework: Requires the ScrollTrigger plugin registered once via                    │
│     gsap.registerPlugin(ScrollTrigger); Use matchMedia('(prefers-reduced-motion:        │
│     reduce)') to skip non-essential motion and render the final state immediately       │
├─── AVOID ───────────────────────────────────────────────────────────────────────────────┤
│     Slow dashboards + decorative charts + hidden error states                           │
├─── PRE-DELIVERY CHECKLIST ──────────────────────────────────────────────────────────────┤
│     [ ] No emojis as icons (use SVG: Heroicons/Lucide)                                  │
│     [ ] cursor-pointer on all clickable elements                                        │
│     [ ] Hover states with smooth transitions (150-300ms)                                │
│     [ ] Light mode: text contrast 4.5:1 minimum                                         │
│     [ ] Focus states visible for keyboard nav                                           │
│     [ ] prefers-reduced-motion respected                                                │
│     [ ] Responsive: 375px, 768px, 1024px, 1440px                                        │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```
