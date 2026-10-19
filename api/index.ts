import 'dotenv/config';
import app from '../src/serverApp.js';

// Official Vercel pattern for Express applications:
// Exporting the Express instance directly allows @vercel/node to handle the full lifecycle
// and wait for res.finish / res.end without prematurely terminating the serverless execution context.
export default app;
