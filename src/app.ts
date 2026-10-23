import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from '@/config/config';
import { errorHandler } from '@/middleware/error.middleware';
import { notFoundHandler } from '@/middleware/notFound.middleware';
import analyticsRoutes from '@/routes/analytics.routes';
import authRoutes from '@/routes/auth.routes';
import customerRoutes from '@/routes/customers.routes';
import paymentRoutes from '@/routes/payments.routes';
import productRoutes from '@/routes/products.routes';
import storeRoutes from '@/routes/store.routes';
import transactionRoutes from '@/routes/transactions.routes';
import userRoutes from '@/routes/users.routes';
import { logger } from '@/utils/logger';

export function createApp(): express.Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: config.client.url,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: config.isTest ? 10_000 : 600,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { success: false, error: 'Too many requests, please slow down' },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(compression());
  if (!config.isTest) {
    app.use(
      morgan(config.isProd ? 'combined' : 'dev', {
        stream: { write: (line) => logger.http(line.trim()) },
      }),
    );
  }

  app.get('/health', (_req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.2.0',
      environment: config.env,
      stellarNetwork: config.stellar.network,
    });
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/store', storeRoutes);
  app.use('/api/v1/products', productRoutes);
  app.use('/api/v1/customers', customerRoutes);
  app.use('/api/v1/transactions', transactionRoutes);
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
