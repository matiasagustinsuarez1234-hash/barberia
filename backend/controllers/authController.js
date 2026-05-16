import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import Client from '../models/Client.js';

const createToken = (user) => {
  return jwt.sign(
    {
      uid: user._id,
      role: user.role || 'client',
      type: user.role ? 'admin' : 'client',
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' },
  );
};

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await Admin.findOne({ username }).populate('shop', 'name');

    if (!user) {
      return res.status(401).json({ ok: false, msg: 'Credenciales invalidas' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ ok: false, msg: 'Credenciales invalidas' });
    }

    const token = createToken(user);
    return res.json({
      ok: true,
      token,
      userType: 'admin',
      role: user.role,
      name: user.username,
      shopName: user.shop?.name || null,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, msg: 'Error en el login', error: error.message });
  }
};

// Login de cliente: solo con celular, sin contrasena
export const clientLogin = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ ok: false, msg: 'Celular requerido' });

    const client = await Client.findOne({ phone });
    if (!client) {
      return res.status(404).json({ ok: false, notFound: true, msg: 'Numero no registrado' });
    }

    const token = createToken(client);
    return res.json({ ok: true, token, userType: 'client', name: client.name });
  } catch (error) {
    return res.status(500).json({ ok: false, msg: 'Error en el login', error: error.message });
  }
};

export const createAdmin = async (req, res) => {
  try {
    if (req.role !== 'superadmin') {
      return res.status(403).json({ ok: false, msg: 'Solo el superadmin puede crear administradores' });
    }
    const { username, password, shop, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ ok: false, msg: 'Faltan datos requeridos' });
    }

    const existing = await Admin.findOne({ username });
    if (existing) {
      return res.status(400).json({ ok: false, msg: 'El nombre de usuario ya existe' });
    }

    const hashed = bcrypt.hashSync(password, 10);
    const admin = new Admin({
      username,
      password: hashed,
      shop: shop || null,
      role: role || 'shopadmin',
    });
    await admin.save();
    return res.status(201).json({ ok: true, admin: { id: admin._id, username: admin.username, role: admin.role } });
  } catch (error) {
    return res.status(500).json({ ok: false, msg: 'Error creando administrador', error: error.message });
  }
};

export const getAdmins = async (req, res) => {
  try {
    if (req.role !== 'superadmin') {
      return res.status(403).json({ ok: false, msg: 'Solo el superadmin puede ver administradores' });
    }
    const admins = await Admin.find().select('-password').populate('shop', 'name');
    res.json({ ok: true, admins });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error obteniendo administradores' });
  }
};

export const deleteAdmin = async (req, res) => {
  try {
    if (req.role !== 'superadmin') {
      return res.status(403).json({ ok: false, msg: 'Solo el superadmin puede eliminar administradores' });
    }
    const { id } = req.params;
    await Admin.findByIdAndDelete(id);
    res.json({ ok: true, msg: 'Administrador eliminado' });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error eliminando administrador' });
  }
};

export const changeOwnPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, msg: 'Faltan datos' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ ok: false, msg: 'La nueva clave debe tener al menos 6 caracteres' });
    }

    const admin = await Admin.findById(req.uid);
    if (!admin) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });

    const valid = bcrypt.compareSync(currentPassword, admin.password);
    if (!valid) return res.status(401).json({ ok: false, msg: 'La clave actual es incorrecta' });

    admin.password = bcrypt.hashSync(newPassword, 10);
    await admin.save();

    return res.json({ ok: true, msg: 'Clave actualizada correctamente' });
  } catch (error) {
    return res.status(500).json({ ok: false, msg: 'Error actualizando la clave' });
  }
};

export const updateAdmin = async (req, res) => {
  try {
    if (req.role !== 'superadmin') {
      return res.status(403).json({ ok: false, msg: 'Solo el superadmin puede editar administradores' });
    }
    const { id } = req.params;
    const { username, password, shop } = req.body;

    const admin = await Admin.findById(id);
    if (!admin) return res.status(404).json({ ok: false, msg: 'Administrador no encontrado' });
    if (admin.role === 'superadmin') return res.status(403).json({ ok: false, msg: 'No se puede editar el superadmin' });

    if (username && username !== admin.username) {
      const exists = await Admin.findOne({ username, _id: { $ne: id } });
      if (exists) return res.status(400).json({ ok: false, msg: 'El nombre de usuario ya existe' });
      admin.username = username;
    }
    if (password) admin.password = bcrypt.hashSync(password, 10);
    if (shop !== undefined) admin.shop = shop || null;

    await admin.save();
    const updated = await Admin.findById(id).select('-password').populate('shop', 'name');
    return res.json({ ok: true, admin: updated });
  } catch (error) {
    return res.status(500).json({ ok: false, msg: 'Error actualizando administrador', error: error.message });
  }
};
