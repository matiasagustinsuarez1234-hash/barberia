import mongoose from 'mongoose';

const SubscriptionSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Barbershop', required: true, unique: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  startDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'cancelled', 'expired'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Subscription', SubscriptionSchema);
