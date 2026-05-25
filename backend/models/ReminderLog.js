import mongoose from 'mongoose';

const ReminderLogSchema = new mongoose.Schema({
  date:       { type: String, required: true },   // '2026-05-26' — día de los turnos
  runAt:      { type: Date,   default: Date.now }, // cuándo corrió el job
  sent:       { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },        // renombrado: 'errors' es reservado en Mongoose
  skipped:    { type: Number, default: 0 },        // sin plan que incluya recordatorios
  failedList: [{
    name:  String,
    phone: String,
    error: String,
  }],
});

export default mongoose.model('ReminderLog', ReminderLogSchema);
