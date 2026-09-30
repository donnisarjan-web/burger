const $ = s => document.querySelector(s), app = $('#app'), modal = $('#modal');
let S = JSON.parse(localStorage.session || 'null'), cart = JSON.parse(localStorage.cart || '{}'), products = [];
const st = JSON.parse(localStorage.style || '{}');
const applyStyle = () => { const r = document.documentElement.style; if (st.bg) r.setProperty('--bg', st.bg); if (st.fw) r.setProperty('--fw', st.fw); if (st.fs) r.setProperty('--fs', st.fs + 'px'); localStorage.style = JSON.stringify(st); };
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function api(url, method = 'GET', body) {
  const r = await fetch('/api' + url, { method, headers: { 'Content-Type': 'application/json', ...(S ? { Authorization: 'Bearer ' + S.token } : {}) }, body: body && JSON.stringify(body) });
  const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Ошибка'); return d;
}
const saveCart = () => { localStorage.cart = JSON.stringify(cart); drawCart(); };
const total = () => products.reduce((s, p) => s + (cart[p.id] || 0) * p.price, 0);
function drawCart() { const n = Object.values(cart).reduce((a, b) => a + b, 0); $('#cartBtn').innerHTML = `<button onclick="openCart()">🛒 Корзина: ${n} · ${total()} сом</button>`; }
function nav() {
  $('#nav').innerHTML = (S ? `<span>${esc(S.user.name)}${S.user.role === 'seller' ? ' (продавец)' : ''}</span>
    <button class="alt" onclick="home()">Меню</button><button class="alt" onclick="orders()">${S.user.role === 'seller' ? 'Заказы' : 'Мои заказы'}</button>
    ${S.user.role === 'seller' ? '<button class="alt" onclick="admin()">Товары</button>' : ''}<button onclick="logout()">Выйти</button>` : `<button onclick="auth()">Войти / Регистрация</button>`)
    + '<button class="alt" onclick="settings()">🎨 Вид</button>';
}
function logout() { S = null; delete localStorage.session; nav(); home(); }
async function home() {
  products = await api('/products'); drawCart();
  app.innerHTML = products.length ? `<div class="grid">${products.map(p => `<div class="card">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : '<img alt="">'}<div><b>${esc(p.name)}</b><span>${esc(p.description)}</span><span class="price">${p.price} сом</span>
    <div class="row" style="padding:0"><button class="alt" onclick="chg('${p.id}',-1)">−</button><b>${cart[p.id] || 0}</b><button onclick="chg('${p.id}',1)">+</button></div></div></div>`).join('')}</div>` : '<div class="panel">Пока нет товаров. Продавец скоро добавит меню.</div>';
}
function chg(id, d) { cart[id] = Math.max(0, (cart[id] || 0) + d); if (!cart[id]) delete cart[id]; saveCart(); home(); }
const show = h => { modal.innerHTML = `<div class="panel">${h}<button class="alt" onclick="modal.hidden=true">Закрыть</button></div>`; modal.hidden = false; };
function openCart() {
  const items = products.filter(p => cart[p.id]);
  if (!items.length) return show('<h2>Корзина пуста</h2><p>Добавьте бургеры из меню.</p>');
  show(`<h2>Ваш заказ</h2>${items.map(p => `<div class="row"><span>${esc(p.name)} × ${cart[p.id]}</span><b>${p.price * cart[p.id]} сом</b></div>`).join('')}<div class="row"><b>Итого</b><b class="price">${total()} сом</b></div>
  <p>Оплата курьеру при получении. Менеджер свяжется с вами по номеру телефона.</p>
  <label>Адрес доставки<input id="addr"></label><label>Комментарий<textarea id="cm" rows="2"></textarea></label><p class="err" id="e"></p><button onclick="order()">Оформить заказ</button> `);
}
async function order() {
  if (!S) { modal.hidden = true; return auth('Чтобы заказать, войдите или зарегистрируйтесь'); }
  try { await api('/orders', 'POST', { items: Object.entries(cart).map(([id, qty]) => ({ id, qty })), address: $('#addr').value, comment: $('#cm').value });
    cart = {}; saveCart(); show('<h2>Заказ принят ✅</h2><p>Менеджер скоро позвонит вам для подтверждения.</p>'); home();
  } catch (e) { $('#e').textContent = e.message; }
}
function auth(msg = '') {
  show(`<h2>Вход</h2><p>${msg}</p><input id="lp" placeholder="Телефон"><input id="lw" type="password" placeholder="Пароль"><p class="err" id="e"></p><button onclick="login()">Войти</button>
  <h2>Регистрация</h2><input id="rn" placeholder="Имя"><input id="rp" placeholder="Телефон"><input id="rw" type="password" placeholder="Пароль (от 4 символов)">
  <input id="rc" placeholder="Код продавца (только для продавца)"><button onclick="reg()">Зарегистрироваться</button> `);
}
async function done(f) { try { S = await f(); localStorage.session = JSON.stringify(S); modal.hidden = true; nav(); home(); } catch (e) { $('#e').textContent = e.message; } }
const login = () => done(() => api('/login', 'POST', { phone: $('#lp').value, password: $('#lw').value }));
const reg = () => done(() => api('/register', 'POST', { name: $('#rn').value, phone: $('#rp').value, password: $('#rw').value, code: $('#rc').value }));
async function orders() {
  const os = await api('/orders'), sl = S.user.role === 'seller', names = { new: 'Новый', called: 'Позвонили', delivered: 'Доставлен', cancel: 'Отменён' };
  app.innerHTML = `<h2>${sl ? 'Заказы (панель менеджера)' : 'Мои заказы'}</h2>` + (os.map(o => `<div class="panel"><div class="row"><b>${new Date(o.date).toLocaleString()}</b><span class="tag">${names[o.status] || o.status}</span></div>
    ${sl ? `<div>${esc(o.name)} · <a href="tel:${esc(o.phone)}">${esc(o.phone)}</a></div>` : ''}<div>Адрес: ${esc(o.address)} ${o.comment ? '· ' + esc(o.comment) : ''}</div>
    <div>${o.items.map(i => esc(i.name) + ' × ' + i.qty).join(', ')}</div><b class="price">${o.total} сом</b>
    ${sl ? `<div class="row">${Object.entries(names).map(([k, v]) => `<button class="alt" onclick="setSt('${o.id}','${k}')">${v}</button>`).join('')}</div>` : ''}</div>`).join('') || '<div class="panel">Заказов пока нет.</div>');
}
async function setSt(id, status) { await api('/orders/' + id, 'PATCH', { status }); orders(); }
async function admin() {
  const ps = await api('/products');
  app.innerHTML = `<div class="panel"><h2>Добавить товар</h2><input id="pn" placeholder="Название"><textarea id="pd" rows="3" placeholder="Описание и состав"></textarea><input id="pr" type="number" placeholder="Цена, сом">
  <input id="pu" placeholder="Ссылка на фото (или загрузите файл ниже)"><input id="pf" type="file" accept="image/*"><p class="err" id="e"></p><button onclick="addP()">Добавить</button></div>
  ${ps.map(p => `<div class="panel row"><span>${esc(p.name)} — ${p.price} сом</span><button onclick="delP('${p.id}')">Удалить</button></div>`).join('')}`;
}
async function addP() {
  try {
    let image = $('#pu').value, f = $('#pf').files[0];
    if (f) image = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
    await api('/products', 'POST', { name: $('#pn').value, description: $('#pd').value, price: +$('#pr').value, image }); admin();
  } catch (e) { $('#e').textContent = e.message; }
}
async function delP(id) { await api('/products/' + id, 'DELETE'); admin(); }
function settings() {
  show(`<h2>Вид сайта</h2><label>Цвет фона <input type="color" id="sb" value="${st.bg || '#f4b42a'}"></label>
  <label>Толщина шрифта: <span id="wv">${st.fw || 600}</span><input type="range" id="sw" min="400" max="900" step="100" value="${st.fw || 600}"></label>
  <label>Размер шрифта: <span id="zv">${st.fs || 18}</span><input type="range" id="sz" min="14" max="26" value="${st.fs || 18}"></label>
  <button class="alt" onclick="delete localStorage.style;location.reload()">Сбросить</button> `);
  $('#sb').oninput = e => { st.bg = e.target.value; applyStyle(); };
  $('#sw').oninput = e => { st.fw = e.target.value; $('#wv').textContent = st.fw; applyStyle(); };
  $('#sz').oninput = e => { st.fs = e.target.value; $('#zv').textContent = st.fs; applyStyle(); };
}
applyStyle(); nav(); home();
