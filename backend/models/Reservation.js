import mongoose from 'mongoose';

const ReservationSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Barbershop', required: true },
  barber: { type: mongoose.Schema.Types.ObjectId, ref: 'Barber', required: true },
  activity: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  endTime: { type: String },
  status: { type: String, default: 'pending', enum: ['pending', 'confirmed', 'cancelled'] },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Reservation', ReservationSchema);
