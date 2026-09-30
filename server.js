const express = require('express'), crypto = require('crypto'), fs = require('fs'), path = require('path');
const SELLER_CODE = process.env.SELLER_CODE || 'kakao123';
const DB = path.join(__dirname, 'data.json'), UP = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(UP, { recursive: true });
let db = fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB)) : { users: [], products: [], orders: [], sessions: {} };
const save = () => fs.writeFileSync(DB, JSON.stringify(db, null, 2));
const hash = (p, s) => crypto.scryptSync(p, s, 32).toString('hex');
const id = () => crypto.randomBytes(6).toString('hex');
const app = express();
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public')));
const auth = (req, res, next) => {
  const u = db.users.find(x => x.id === db.sessions[(req.headers.authorization || '').replace('Bearer ', '')]);
  if (!u) return res.status(401).json({ error: 'Войдите в аккаунт' });
  req.user = u; next();
};
const seller = (req, res, next) => req.user.role === 'seller' ? next() : res.status(403).json({ error: 'Только для продавца' });
const session = u => { const t = crypto.randomBytes(24).toString('hex'); db.sessions[t] = u.id; save(); return { token: t, user: { name: u.name, phone: u.phone, role: u.role } }; };

app.post('/api/register', (req, res) => {
  const { name, phone, password, code } = req.body;
  if (!name || !phone || !password || password.length < 4) return res.status(400).json({ error: 'Заполните имя, телефон и пароль (от 4 символов)' });
  if (db.users.some(u => u.phone === phone)) return res.status(400).json({ error: 'Этот номер уже зарегистрирован' });
  if (code && code !== SELLER_CODE) return res.status(400).json({ error: 'Неверный код продавца' });
  const salt = id(), u = { id: id(), name, phone, salt, pass: hash(password, salt), role: code ? 'seller' : 'client' };
  db.users.push(u); res.json(session(u));
});
app.post('/api/login', (req, res) => {
  const u = db.users.find(x => x.phone === req.body.phone);
  if (!u || u.pass !== hash(req.body.password || '', u.salt)) return res.status(400).json({ error: 'Неверный номер или пароль' });
  res.json(session(u));
});
app.get('/api/products', (req, res) => res.json(db.products));
app.post('/api/products', auth, seller, (req, res) => {
  let { name, description, price, image } = req.body;
  if (!name || !(price > 0)) return res.status(400).json({ error: 'Нужны название и цена' });
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/.exec(image || '');
  if (m) { const f = id() + '.' + m[1].replace('jpeg', 'jpg'); fs.writeFileSync(path.join(UP, f), Buffer.from(m[2], 'base64')); image = '/uploads/' + f; }
  const p = { id: id(), name, description: description || '', price: +price, image: image || '' };
  db.products.push(p); save(); res.json(p);
});
app.delete('/api/products/:id', auth, seller, (req, res) => { db.products = db.products.filter(p => p.id !== req.params.id); save(); res.json({ ok: 1 }); });
app.post('/api/orders', auth, (req, res) => {
  const items = (req.body.items || []).map(i => { const p = db.products.find(x => x.id === i.id); return p && i.qty > 0 ? { name: p.name, price: p.price, qty: Math.floor(i.qty) } : null; }).filter(Boolean);
  if (!items.length || !req.body.address) return res.status(400).json({ error: 'Добавьте товары и укажите адрес' });
  const o = { id: id(), userId: req.user.id, name: req.user.name, phone: req.user.phone, address: req.body.address, comment: req.body.comment || '', items, total: items.reduce((s, i) => s + i.price * i.qty, 0), status: 'new', date: new Date().toISOString() };
  db.orders.push(o); save(); res.json(o);
});
app.get('/api/orders', auth, (req, res) => res.json(db.orders.filter(o => req.user.role === 'seller' || o.userId === req.user.id).reverse()));
app.patch('/api/orders/:id', auth, seller, (req, res) => { const o = db.orders.find(x => x.id === req.params.id); if (o) { o.status = req.body.status; save(); } res.json(o); });
app.listen(process.env.PORT || 3000, () => console.log('http://localhost:' + (process.env.PORT || 3000)));
