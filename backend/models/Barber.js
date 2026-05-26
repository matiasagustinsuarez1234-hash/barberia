import mongoose from 'mongoose';

const BarberSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Barbershop', required: true },
  name: { type: String, required: true },
  active: { type: Boolean, default: true },
  specialties: { type: [String], default: [] },
  whatsapp: { type: String },
  surchargeType: { type: String, enum: ['none', 'percent', 'fixed'], default: 'none' },
  surchargeValue: { type: Number, default: 0 },
  activities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Activity' }],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Barber', BarberSchema);
