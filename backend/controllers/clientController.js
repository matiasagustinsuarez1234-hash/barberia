import bcrypt from 'bcryptjs';
import Client from '../models/Client.js';
import Reservation from '../models/Reservation.js';

export const getClients = async (req, res) => {
  try {
    let clients;
    if (req.role === 'superadmin') {
      clients = await Client.find().select('-password').sort('name');
    } else {
      const clientsFromRes = await Reservation.find({ shop: req.user.shop }).distinct('client');
      const clientsCreated = await Client.find({ shop: req.user.shop }).select('_id');
      const ids = [...new Set([...clientsFromRes.map(String), ...clientsCreated.map((c) => c._id.toString())])];
      clients = await Client.find({ _id: { $in: ids } }).select('-password').sort('name');
    }
    res.json({ ok: true, clients });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error obteniendo clientes' });
  }
};

export const createClient = async (req, res) => {
  try {
    const { username, password, name, phone, email } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ ok: false, msg: 'Faltan datos requeridos' });
    }
    const existing = await Client.findOne({ username });
    if (existing) {
      return res.status(400).json({ ok: false, msg: 'El usuario ya existe' });
    }
    const hashed = bcrypt.hashSync(password, 10);
    const shop = req.role === 'superadmin' ? null : req.user.shop;
    const client = new Client({ username, password: hashed, name, phone, email, shop });
    await client.save();
    res.status(201).json({ ok: true, client: { _id: client._id, username: client.username, name: client.name, phone: client.phone, email: client.email } });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error creando cliente' });
  }
};

export const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, password } = req.body;
    const update = {};
    if (name) update.name = name;
    if (phone !== undefined) update.phone = phone;
    if (email !== undefined) update.email = email;
    if (password) update.password = bcrypt.hashSync(password, 10);

    const client = await Client.findByIdAndUpdate(id, update, { returnDocument: 'after' }).select('-password');
    if (!client) return res.status(404).json({ ok: false, msg: 'Cliente no encontrado' });
    res.json({ ok: true, client });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error actualizando cliente' });
  }
};

export const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;
    await Client.findByIdAndDelete(id);
    res.json({ ok: true, msg: 'Cliente eliminado' });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error eliminando cliente' });
  }
};
