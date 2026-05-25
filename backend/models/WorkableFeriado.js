import mongoose from 'mongoose';

const WorkableFeriadoSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Barbershop', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
});

WorkableFeriadoSchema.index({ shop: 1, date: 1 }, { unique: true });

export default mongoose.model('WorkableFeriado', WorkableFeriadoSchema);
