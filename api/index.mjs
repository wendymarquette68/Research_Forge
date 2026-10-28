// Vercel serverless entry: the same Express app, without listen().
// Vercel serves the built client statically and routes /api/* here
// (see vercel.json). MODEL_API_KEY is set in the Vercel dashboard only.
import app from '../server/src/app.js';

export default app;
