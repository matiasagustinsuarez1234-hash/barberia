import mongoose from 'mongoose';

const BarbershopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  cuit: { type: String },
  address: { type: String },
  phone: { type: String },
  whatsappNumber: { type: String },
  image: { type: String },
  logo: { type: String },
  areaCode: { type: String, default: '11' },
  active: { type: Boolean, default: true },
  mercadopagoEnabled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Barbershop', BarbershopSchema);
