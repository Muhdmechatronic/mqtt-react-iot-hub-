const svc = require('../services/datastreamService');

async function list(req, res) {
  const { device_id } = req.query;
  if (!device_id) return res.status(400).json({ error: 'device_id required' });
  const rows = await svc.getByDevice(parseInt(device_id), req.user.id);
  res.json(rows);
}

async function create(req, res) {
  const { device_id, virtual_pin, name, display_name, data_type, access_type, unit, min_value, max_value, default_value } = req.body;

  if (!device_id)    return res.status(400).json({ error: 'device_id required' });
  if (virtual_pin === undefined || virtual_pin === null) return res.status(400).json({ error: 'virtual_pin required' });
  if (!name)         return res.status(400).json({ error: 'name required' });
  if (!display_name) return res.status(400).json({ error: 'display_name required' });
  if (!data_type)    return res.status(400).json({ error: 'data_type required' });

  const pin = parseInt(virtual_pin);
  if (isNaN(pin) || pin < 0 || pin > 255) return res.status(400).json({ error: 'virtual_pin must be 0–255' });

  // Validate min < max when both supplied and type is numeric
  if (data_type !== 'string' && min_value !== '' && max_value !== '' &&
      min_value !== null && max_value !== null &&
      parseFloat(min_value) >= parseFloat(max_value)) {
    return res.status(400).json({ error: 'max must be greater than min' });
  }

  if (await svc.isPinTaken(parseInt(device_id), pin)) {
    return res.status(409).json({ error: `V${pin} is already used on this device` });
  }

  const id = await svc.create({
    userId: req.user.id, deviceId: parseInt(device_id),
    virtualPin: pin, name: name.trim(), displayName: display_name.trim(),
    dataType: data_type, accessType: access_type,
    unit, minValue: min_value, maxValue: max_value, defaultValue: default_value,
  });

  res.status(201).json({ id, virtual_pin: pin });
}

async function update(req, res) {
  const { id } = req.params;
  const { device_id, virtual_pin, name, display_name, data_type, access_type, unit, min_value, max_value, default_value } = req.body;

  const pin = parseInt(virtual_pin);
  if (isNaN(pin) || pin < 0 || pin > 255) return res.status(400).json({ error: 'virtual_pin must be 0–255' });

  if (data_type !== 'string' && min_value !== '' && max_value !== '' &&
      min_value !== null && max_value !== null &&
      parseFloat(min_value) >= parseFloat(max_value)) {
    return res.status(400).json({ error: 'max must be greater than min' });
  }

  if (device_id && await svc.isPinTaken(parseInt(device_id), pin, parseInt(id))) {
    return res.status(409).json({ error: `V${pin} is already used on this device` });
  }

  await svc.update(parseInt(id), req.user.id, {
    virtualPin: pin, name: name.trim(), displayName: display_name.trim(),
    dataType: data_type, accessType: access_type,
    unit, minValue: min_value, maxValue: max_value, defaultValue: default_value,
  });

  res.json({ message: 'Datastream updated' });
}

async function remove(req, res) {
  await svc.remove(parseInt(req.params.id), req.user.id);
  res.json({ message: 'Datastream deleted' });
}

module.exports = { list, create, update, remove };
