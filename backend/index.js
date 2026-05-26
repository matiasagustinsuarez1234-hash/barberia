import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { startReminderJob } from './utils/reminderJob.js';

import { dbMongo } from './database/dbConnection.js';
import authRoutes from './routes/auth.routes.js';
import shopsRoutes from './routes/shops.routes.js';
import barbersRoutes from './routes/barbers.routes.js';
import activitiesRoutes from './routes/activities.routes.js';
import schedulesRoutes from './routes/schedules.routes.js';
import reservationsRoutes from './routes/reservations.routes.js';
import clientsRoutes from './routes/clients.routes.js';
import plansRoutes from './routes/plans.routes.js';
import subscriptionsRoutes from './routes/subscriptions.routes.js';
import publicRoutes from './routes/public.routes.js';
import otpRoutes from './routes/otp.routes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';
import closedDaysRoutes from './routes/closedDays.routes.js';
import workedFeriadosRoutes from './routes/workedFeriados.routes.js';
import reminderLogsRoutes from './routes/reminderLogs.routes.js';
import pushRoutes from './routes/push.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const server = express();

const api = async () => {
  const API_PORT = process.env.PORT || 4000;
  const allowedOrigins = (process.env.FRONTEND_URL || '').split(',').map((o) => o.trim());

  server.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('CORS no permitido'), false);
      },
      credentials: true,
    }),
  );

  server.use(express.json());
  server.use('/uploads', express.static(path.join(__dirname, 'uploads')));
  console.log("URI:", process.env.MONGO_URI);
  await dbMongo();

  server.use('/api/public', publicRoutes);
  server.use('/api/otp', otpRoutes);
  server.use('/api/whatsapp', whatsappRoutes);
  server.use('/api/auth', authRoutes);
  server.use('/api/shops', shopsRoutes);
  server.use('/api/barbers', barbersRoutes);
  server.use('/api/activities', activitiesRoutes);
  server.use('/api/schedules', schedulesRoutes);
  server.use('/api/reservations', reservationsRoutes);
  server.use('/api/clients', clientsRoutes);
  server.use('/api/plans', plansRoutes);
  server.use('/api/subscriptions', subscriptionsRoutes);
  server.use('/api/closed-days', closedDaysRoutes);
  server.use('/api/worked-feriados', workedFeriadosRoutes);
  server.use('/api/reminder-logs', reminderLogsRoutes);
  server.use('/api/push', pushRoutes);

  startReminderJob();

  server.listen(API_PORT, () => {
    console.log(`Servidor backend barberia en http://localhost:${API_PORT}`);
  });
};

api().catch((error) => {
  console.error(error);
  process.exit(1);
});

