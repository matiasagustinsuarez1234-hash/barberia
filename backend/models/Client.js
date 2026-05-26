import mongoose from 'mongoose';

const ClientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, default: '' },
  pushSubscription: { type: mongoose.Schema.Types.Mixed, default: null }, // Web Push subscription object
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Client', ClientSchema);
