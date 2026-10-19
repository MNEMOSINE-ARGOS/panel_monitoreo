import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import app from './src/serverApp.js';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    // Standalone public page (separate entry from the dashboard SPA)
    app.get('/comparativo', async (req, res, next) => {
      try {
        const raw = fs.readFileSync(path.join(process.cwd(), 'comparativo.html'), 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, raw);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        next(e);
      }
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/comparativo', (req, res) => {
      res.sendFile(path.join(distPath, 'comparativo.html'));
    });
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Media Monitoring BI Server active on http://0.0.0.0:${PORT}`);
  });
}

// Only launch standalone web server in long-running container / local mode (not in Vercel or AWS Lambda)
const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.NOW_REGION
);

if (!isServerless && process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
