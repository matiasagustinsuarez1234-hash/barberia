import mongoose from 'mongoose';

const PlanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true },
  maxBarbers: { type: Number, required: true },
  includesReminders: { type: Boolean, default: false },
  includesEmailNotifications: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Plan', PlanSchema);
