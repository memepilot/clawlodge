# ClawLodge Multilingual SEO Plan

## Goal

Turn ClawLodge from a cookie-based bilingual UI into a path-based multilingual SEO site with:

- English as the default language
- Chinese on `/zh/...`
- Japanese on `/ja/...`

The goal is SEO, not just UI translation. Each language should have:

- stable indexable URLs
- self-contained metadata
- language-local internal links
- sitemap coverage
- `hreflang` relationships

## External reference

HIX.AI is a useful reference because it uses path-based language entry points such as:

- `/`
- `/ja`

That is the right model to copy for SEO. It gives search engines distinct URLs per language instead of relying on cookie state.

## Current state in ClawLodge

### What exists now

- App Router pages are flat English-first routes:
  - `/`
  - `/categories/[category]`
  - `/topics/[topic]`
  - `/tags/[tag]`
  - `/guides/[slug]`
  - `/lobsters/[slug]`
- Locale support currently exists only in application state:
  - `lib/i18n.ts`
  - `lib/server/locale.ts`
  - `components/locale-switcher.tsx`
- Current locale mechanism:
  - supports only `en` and `zh`
  - reads cookie or `Accept-Language`
  - switches via `/api/v1/locale`

### What is missing for SEO

- no path-based language URLs
- no Japanese support
- no `hreflang`
- no language-specific sitemap split
- no language-local canonical strategy
- no language-local internal linking strategy

## High-level architecture

### Recommended URL model

Keep English as the canonical default URL set:

- `/`
- `/categories/[category]`
- `/topics/[topic]`
- `/tags/[tag]`
- `/guides/[slug]`
- `/lobsters/[slug]`

Add Chinese:

- `/zh`
- `/zh/categories/[category]`
- `/zh/topics/[topic]`
- `/zh/tags/[tag]`
- `/zh/guides/[slug]`
- `/zh/lobsters/[slug]`

Add Japanese:

- `/ja`
- `/ja/categories/[category]`
- `/ja/topics/[topic]`
- `/ja/tags/[tag]`
- `/ja/guides/[slug]`
- `/ja/lobsters/[slug]`

### Why this model

- preserves existing English URLs and rankings
- adds indexable Chinese and Japanese pages
- keeps route semantics clean
- allows per-language metadata and internal links

## Phase 1: Locale and routing foundation

### Objective

Replace cookie-first language switching with route-first language handling.

### Changes

1. Extend supported locales from:
   - `en`
   - `zh`

   to:
   - `en`
   - `zh`
   - `ja`

2. Introduce a route-aware locale helper:
   - locale should come from pathname prefix first
   - cookie becomes secondary, for preference only

3. Introduce an app route group or dynamic segment for localized pages.

Recommended structure:

- `app/(default)/...` for existing English routes
- `app/[locale]/...` for `zh` and `ja`

Alternative:

- `app/(site)/...`
- `app/(localized)/[locale]/...`

### Files likely affected

- `lib/i18n.ts`
- `lib/server/locale.ts`
- `components/locale-switcher.tsx`
- `app/layout.tsx`
- all route modules that currently call `getRequestLocale()`

## Phase 2: Metadata and canonical strategy

### Objective

Make each language version independently indexable and properly linked.

### Rules

1. Every page must self-canonical to its own language URL
   - `/guides/openclaw-multi-agent-config` canonical -> itself
   - `/zh/guides/openclaw-multi-agent-config` canonical -> itself
   - `/ja/guides/openclaw-multi-agent-config` canonical -> itself

2. Every page must expose `alternates.languages`
   - `en`
   - `zh-CN`
   - `ja`
   - `x-default`

3. No language page should canonical back to English unless it is a true duplicate with no localized content.

### Files likely affected

- `app/layout.tsx`
- `lib/site.ts`
- `lib/lobster-taxonomy.ts`
- `lib/guides.ts`
- `app/page.tsx`
- `app/categories/[category]/page.tsx`
- `app/topics/[topic]/page.tsx`
- `app/tags/[tag]/page.tsx`
- `app/guides/[slug]/page.tsx`
- `app/lobsters/[slug]/page.tsx`

## Phase 3: Content priority for launch

### Objective

Do not translate everything at once. Launch the highest-value SEO pages first.

### Launch wave 1

Pages to localize first:

- homepage
- category pages
- topic pages
- guide pages

Reasons:

- these pages are already structured and metadata-friendly
- they carry the most internal-link leverage
- they can target broader non-brand search intent

### Launch wave 2

Pages to localize next:

- tag pages
- lobster detail shell content
  - subtitle
  - breadcrumb
  - section labels
  - related links
  - guide link labels

The README body can remain source-language for phase 2.

### Launch wave 3

Optional deeper localization:

- curated translated summaries for top lobsters
- localized guide expansions
- localized creator pages

## Phase 4: Language-aware internal linking

### Objective

Build language-local link graphs instead of sending users and crawlers back to English.

### Requirements

1. Homepage must link to:
   - categories
   - topics
   - guides

2. Category pages must link to:
   - related guides
   - related topics

3. Topic pages must link to:
   - related guides
   - related categories

4. Guide pages must link to:
   - relevant category pages
   - relevant topic pages
   - relevant lobster detail pages

5. Lobster detail pages must link to:
   - category
   - topic
   - tags
   - related guides
   - related lobsters

### Language rule

If the user is on:

- `/zh/...`
  - all internal links should point to `/zh/...` equivalents when they exist
- `/ja/...`
  - all internal links should point to `/ja/...` equivalents when they exist

English pages should remain English-first.

## Phase 5: Sitemap and robots

### Objective

Expose multilingual structure clearly to crawlers.

### Recommended sitemap structure

- `/sitemap.xml` as index
- `/sitemap-en.xml`
- `/sitemap-zh.xml`
- `/sitemap-ja.xml`

Each sitemap should include:

- homepage
- categories
- topics
- tags
- guides
- lobster detail pages

### Robots strategy

Keep the same blocklist rules for all language variants.

Pages that are not search targets should remain non-indexable across languages, for example:

- `/settings`
- `/publish`
- `/api/*`

## Phase 6: Translation content model

### Objective

Avoid thin or purely mechanical translation.

### Recommendation

Separate translation layers:

1. UI strings
   - navigation
   - buttons
   - section labels

2. SEO strings
   - title
   - description
   - intro copy

3. Guide content
   - first-class translated Markdown

4. Optional lobster shell localization
   - summary fallback
   - “what this is for”
   - “best fit”
   - “not ideal for”

### Storage strategy

Use structured content by locale for:

- guides
- category intros
- topic intros
- metadata templates

Avoid trying to machine-translate arbitrary README bodies in phase 1.

## Phase 7: Locale switcher redesign

### Objective

Make the language switcher SEO-safe.

### Current problem

Current switcher:

- toggles only `en` and `zh`
- goes through `/api/v1/locale`
- depends on cookie

That is fine for UX, but weak for SEO.

### New behavior

The switcher should:

- detect current route type
- map to equivalent localized route
- link directly to the target localized URL

Examples:

- `/guides/openclaw-multi-agent-config` -> `/zh/guides/openclaw-multi-agent-config`
- `/categories/workspace` -> `/ja/categories/workspace`

Cookie may still be written for convenience, but the URL must be primary.

## Suggested implementation order

### Step 1

Add locale-aware routing and `ja` support without changing English URLs.

### Step 2

Localize:

- homepage
- categories
- topics
- guides

### Step 3

Add:

- `hreflang`
- alternates
- multilingual sitemap
- locale-aware switcher

### Step 4

Add localized shell content to lobster detail pages.

### Step 5

Refine internal linking so each language has a self-contained crawl path.

## Success criteria

The migration is successful when:

1. Chinese and Japanese pages are reachable without cookies
2. Search engines can discover them via sitemap
3. Each localized page has self-canonical + `hreflang`
4. Internal links remain inside the same language
5. English traffic is preserved because current English URLs stay stable

## First engineering milestone

The first concrete milestone should be:

- `/zh`
- `/ja`
- `/zh/categories/[category]`
- `/ja/categories/[category]`
- `/zh/topics/[topic]`
- `/ja/topics/[topic]`
- `/zh/guides/[slug]`
- `/ja/guides/[slug]`

This is the fastest way to create real multilingual SEO assets without touching every lobster detail page on day one.
