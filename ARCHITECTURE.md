# Architecture

## Request path

1. React authenticates with Supabase Auth.
2. The browser calls a JWT-protected Edge Function.
3. The function verifies the user and validates the request.
4. The function checks daily usage.
5. The server selects an allowlisted provider model.
6. A generation row is created in processing state.
7. Text and image responses finish synchronously.
8. Video returns a persistent Veo operation name.
9. The browser polls video-status every ten seconds.
10. When complete, the Edge Function downloads the MP4 into private Storage.
11. History returns a fresh one-hour signed URL for each asset.

## Trust boundaries

- Browser: untrusted, anon key only.
- Supabase Auth: identity provider.
- Postgres plus RLS: user data boundary.
- Edge Functions: trusted provider gateway.
- Storage: private bucket with user-prefixed objects.
- OpenAI and Google: external generation providers.

## Generation state machine

    queued -> processing -> completed
                         -> failed

Video records can remain processing across page refreshes because provider_job_id is persisted.

## Failure recovery

- Provider request errors mark the generation failed.
- Video polling can resume from History.
- Signed URLs are recreated on each History request.
- Deletion removes stored media before deleting the database record.
- Failed requests do not expose API keys in returned error messages.
