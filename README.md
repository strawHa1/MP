<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/547ab606-21b8-4e83-917c-5a42c71de95c

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. **Add your Gemini API key.** Open [`.env`](.env) in the project root and replace
   `your_key_here` with your real key:

   ```
   GEMINI_API_KEY="AIza...your-real-key..."
   ```

   Get a free key at https://aistudio.google.com/apikey.
   `.env` is git-ignored, so the key never gets committed. Never hardcode it in source.
3. Run the app:
   `npm run dev`

## AI Assistant

The chat assistant at `/chat` streams answers from Gemini token-by-token over
Server-Sent Events (`POST /api/chat/stream`) and keeps the full conversation in
context for the session.

On startup the server prints whether the key was picked up:

- `[AI] GEMINI_API_KEY loaded — Black Swan AI Assistant is live (streaming enabled).`
- Otherwise a warning banner names the exact file to edit.

Restart the server after editing `.env` — env vars are read once at boot.

Without a key the assistant reports itself offline instead of inventing answers, and
these commands keep working because they run client-side against live quotes:

- `Invest $5,000 in NVDA` / `Withdraw $2,000 from TSM` — shows a confirmation card;
  nothing executes until you confirm.
- `Alert me if TSM drops below $150` — saved and surfaced in the Alerts Center.
