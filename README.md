# MindMesh AI Studio Pro

MindMesh AI Studio Pro is a complete Bolt-compatible multimodal application for AI text, image, and video generation. It combines a responsive React interface with secure Supabase Edge Functions, private cloud storage, authenticated generation history, prompt templates, prompt enhancement, favorites, filters, quotas, and asynchronous Veo job recovery.

## What is included

### Text Studio

- OpenAI Responses API
- GPT model configured through a server-only environment variable
- Output formats, tones, and creativity controls
- AI prompt enhancement
- Copy and text-file export

### Image Studio

- Google Gemini 3.1 Flash Image, the supported successor to retired Imagen
- Square, portrait, landscape, and classic aspect ratios
- Negative prompts and optional deterministic seeds
- Private Supabase Storage with temporary signed URLs

### Video Studio

- Google Veo 3.1
- 4, 6, and 8-second generation
- 16:9 and 9:16 formats
- 720p, 1080p, and 4K controls
- Native audio control
- Persistent long-running operation IDs
- Automatic ten-second polling and manual recovery from History
- Completed MP4 download into private cloud storage

### Platform

- Email/password authentication
- Per-user Postgres records protected by Row Level Security
- Private user-scoped media paths
- Signed asset URLs that expire
- Generation search and type filters
- Favorites and safe deletion of database plus media
- Daily quota tracking
- Reusable creator prompt templates
- Responsive premium dark interface
- Local demo mode without paid APIs
- TypeScript checks, Vite production build, and Vitest tests

## Quick preview without APIs

Copy the environment template:

    cp .env.example .env

Set:

    VITE_DEMO_MODE=true

Then run:

    npm install
    npm run dev

Open http://localhost:5173. Demo generations are stored in browser local storage.

## Production setup

### 1. Create Supabase

Create a Supabase project and retrieve the Project URL and anon key from Project Settings.

Set these in the Bolt Secrets or Environment panel:

    VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
    VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
    VITE_DEMO_MODE=false

### 2. Apply the database

Install and authenticate the Supabase CLI:

    npx supabase login
    npx supabase link --project-ref YOUR_PROJECT_REF
    npx supabase db push

The migration creates profiles, generations, usage events, indexes, triggers, Row Level Security policies, and the private generations bucket.

### 3. Set protected provider secrets

    npx supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_KEY
    npx supabase secrets set GOOGLE_AI_API_KEY=YOUR_GOOGLE_AI_KEY
    npx supabase secrets set OPENAI_TEXT_MODEL=gpt-5.6
    npx supabase secrets set GOOGLE_IMAGE_MODEL=gemini-3.1-flash-image
    npx supabase secrets set GOOGLE_VIDEO_MODEL=veo-3.1-generate-preview
    npx supabase secrets set DAILY_GENERATION_LIMIT=50

Never create VITE_OPENAI_API_KEY or VITE_GOOGLE_AI_API_KEY. Variables beginning with VITE_ are bundled into browser JavaScript.

### 4. Deploy server functions

    npx supabase functions deploy generate
    npx supabase functions deploy video-status
    npx supabase functions deploy enhance-prompt
    npx supabase functions deploy history

### 5. Verify locally

    npm install
    npm run typecheck
    npm test
    npm run build
    npm run dev

### 6. Import into Bolt

Push the project to a GitHub repository. In Bolt choose Import from GitHub, select the repository, add the three public Vite environment values, and run npm install. Keep OpenAI and Google provider secrets in Supabase, not Bolt's browser environment.

## Folder map

    src/
      components/        Reusable studio, result, template, usage and history UI
      config/            Model labels, controls and prompt templates
      hooks/             Automatic Veo polling
      lib/               Supabase client, API gateway, demo mode and validation
      pages/             Authentication, creation studio and history
    supabase/
      migrations/        Complete database, storage and security schema
      functions/
        _shared/         Authentication, validation, quotas, storage and responses
        generate/        OpenAI text, Google image and Veo job creation
        video-status/    Veo polling, MP4 download and storage
        enhance-prompt/  GPT-powered prompt improvement
        history/         Signed history, favorites, deletion and usage

## Security decisions

- The browser never receives provider API keys or the Supabase service role.
- Every Edge Function validates the bearer token.
- Every history query is explicitly scoped to the authenticated user.
- Storage is private and paths begin with the authenticated user ID.
- RLS provides defense in depth.
- API error strings redact recognizable provider key formats.
- Generation model IDs are selected on the server and cannot be overridden by a browser.
- Request sizes, prompt lengths, enums, and settings are validated.

## Before a public launch

- Enable CAPTCHA and leaked-password protection in Supabase Auth.
- Configure provider spend limits and billing alerts.
- Add Stripe subscription webhooks if selling plans.
- Replace simple daily quota checks with a transactional RPC under heavy traffic.
- Add a Supabase Cron worker to poll abandoned Veo operations.
- Add Sentry or another error-monitoring platform.
- Set a Content Security Policy for your final domain.
- Review Google and OpenAI usage policies for your target audience.

Google retired Imagen on August 17, 2026. This project intentionally uses Gemini 3.1 Flash Image instead of shipping a nonfunctional legacy endpoint.
