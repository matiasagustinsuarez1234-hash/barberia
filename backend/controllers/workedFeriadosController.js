import WorkableFeriado from '../models/WorkableFeriado.js';

// GET /api/worked-feriados — lista de fechas que la barbería eligió trabajar
export const getWorkedFeriados = async (req, res) => {
  try {
    const shopId = req.user.shop;
    const records = await WorkableFeriado.find({ shop: shopId }).select('date');
    res.json({ ok: true, dates: records.map((r) => r.date) });
  } catch {
    res.status(500).json({ ok: false, msg: 'Error obteniendo feriados trabajados' });
  }
};

// POST /api/worked-feriados — marcar un feriado como trabajado
export const addWorkedFeriado = async (req, res) => {
  try {
    const shopId = req.user.shop;
    const { date } = req.body;
    if (!date) return res.status(400).json({ ok: false, msg: 'Falta la fecha' });
    await WorkableFeriado.findOneAndUpdate(
      { shop: shopId, date },
      { shop: shopId, date },
      { upsert: true, new: true },
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, msg: 'Error guardando feriado trabajado' });
  }
};

// DELETE /api/worked-feriados/:date — desmarcar un feriado (vuelve a bloquearse)
export const removeWorkedFeriado = async (req, res) => {
  try {
    const shopId = req.user.shop;
    const { date } = req.params;
    await WorkableFeriado.deleteOne({ shop: shopId, date });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, msg: 'Error eliminando feriado trabajado' });
  }
};
