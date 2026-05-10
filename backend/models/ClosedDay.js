import mongoose from 'mongoose';

const ClosedDaySchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Barbershop', required: true },
  date: { type: String, required: true },
  reason: { type: String },
  createdAt: { type: Date, default: Date.now },
});

ClosedDaySchema.index({ shop: 1, date: 1 }, { unique: true });

export default mongoose.model('ClosedDay', ClosedDaySchema);
