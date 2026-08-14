
const KEY = 'sudan_market_v4';
let userCoords = null;
let activeFriendId = null;
let mediaRecorder = null;
let audioChunks = [];

const ADMIN_USER = {
  id: 'admin_1',
  name: 'أنس',
  email: 'anas@market.com',
  password: '12345',
  role: 'admin'
};

const initialData = {
  users: [ADMIN_USER],
  currentUser: null,
  markets: [
    { id: 1, name: 'السوق العربي', city: 'الخرطوم', lat: 15.5997, lng: 32.5312, image: 'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&w=500&q=80' },
    { id: 2, name: 'سوق ليبيا', city: 'أم درمان', lat: 15.6500, lng: 32.4300, image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=500&q=80' }
  ],
  products: [
    { id: 1, name: 'طماطم طازجة', category: 'خضروات', price: 2500, unit: 'كيلو', market: 'السوق العربي', image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=200&q=80' },
    { id: 2, name: 'بصل أحمر', category: 'خضروات', price: 1800, unit: 'كيلو', market: 'سوق ليبيا', image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=200&q=80' }
  ],
  favorites: {}, // { userId: [prodId1, prodId2] }
  friends: {},   // { userId: [friendId1, friendId2] }
  chats: [],     // [ { id, senderId, receiverId, type, content, fileName, timestamp } ]
  stories: []    // [ { id, userId, userName, type, content, createdAt } ]
};

let db;
try {
  db = JSON.parse(localStorage.getItem(KEY)) || initialData;
  if (!db.favorites) db.favorites = {};
  if (!db.friends) db.friends = {};
  if (!db.chats) db.chats = [];
  if (!db.stories) db.stories = [];
  if (!db.users.some(u => u.name === 'أنس')) db.users.push(ADMIN_USER);
} catch (e) {
  db = initialData;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('LocalStorage مليء أو غير متاح');
  }
}

function getCurrentUser() {
  if (!db.currentUser) return null;
  return db.users.find(u => u.id === db.currentUser.id || u.id === db.currentUser) || null;
}

function isAdmin() {
  const u = getCurrentUser();
  return u && u.role === 'admin';
}

function showScreen(id) {
  const user = getCurrentUser();
  if (!user && id !== 'login' && id !== 'splash') {
    toast('يجب تسجيل الدخول أولاً');
    id = 'login';
  }
  if (id === 'admin' && !isAdmin()) {
    toast('خاص بالمدير فقط');
    id = 'home';
  }

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  
  renderAll();
  window.scrollTo(0, 0);
}

function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function money(n) {
  return Number(n).toLocaleString('ar-SD') + ' ج.س';
}

function navHTML() {
  const admin = isAdmin();
  return `
    <button class="nav-item" onclick="showScreen('home')">🏠<span>الرئيسية</span></button>
    <button class="nav-item" onclick="showScreen('markets')">🏪<span>الأسواق</span></button>
    ${admin ? '<button class="nav-item" onclick="openProductModal()">＋<span>إضافة</span></button>' : ''}
    <button class="nav-item" onclick="showScreen('chats')">💬<span>الدردشة</span></button>
    <button class="nav-item" onclick="showScreen('favorites')">♡<span>المفضلة</span></button>
    <button class="nav-item" onclick="showScreen('profile')">👤<span>حسابي</span></button>
  `;
}

// === نظام الحالات اليومية (STORIES) ===
function openAddStoryModal() {
  document.getElementById('modalTitle').textContent = 'إضافة حالة جديدة';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label>نوع الحالة</label>
      <select id="storyType" onchange="toggleStoryInput()">
        <option value="text">نصية</option>
        <option value="image">صورة / فيديو (ملف)</option>
      </select>
    </div>
    <div class="form-group" id="storyTextInput">
      <label>محتوى النص</label>
      <input id="storyTextContent" placeholder="اكتب حالتك هنا...">
    </div>
    <div class="form-group" id="storyFileInput" style="display:none;">
      <label>اختر الملف</label>
      <input type="file" id="storyFileContent" accept="image/*,video/*">
    </div>
    <button class="primary" onclick="saveStory()">نشر الحالة</button>
  `;
  document.getElementById('modal').classList.add('show');
}

function toggleStoryInput() {
  const type = document.getElementById('storyType').value;
  document.getElementById('storyTextInput').style.display = type === 'text' ? 'block' : 'none';
  document.getElementById('storyFileInput').style.display = type === 'image' ? 'block' : 'none';
}

function saveStory() {
  const user = getCurrentUser();
  const type = document.getElementById('storyType').value;

  if (type === 'text') {
    const txt = document.getElementById('storyTextContent').value.trim();
    if (!txt) return toast('اكتب النص أولاً');
    addStoryObj(user, 'text', txt);
  } else {
    const file = document.getElementById('storyFileContent').files[0];
    if (!file) return toast('اختر ملفاً');
    const isVideo = file.type.startsWith('video/');
    const reader = new FileReader();
    reader.onload = () => addStoryObj(user, isVideo ? 'video' : 'image', reader.result);
    reader.readAsDataURL(file);
  }
}

function addStoryObj(user, type, content) {
  db.stories.push({
    id: Date.now(),
    userId: user.id,
    userName: user.name,
    type,
    content,
    createdAt: Date.now()
  });
  save();
  closeModal();
  renderStories();
  toast('تم نشر الحالة');
}

function renderStories() {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  db.stories = db.stories.filter(s => (now - s.createdAt) < TWENTY_FOUR_HOURS);
  save();

  const container = document.getElementById('storiesBar');
  if (!container) return;

  if (db.stories.length === 0) {
    container.innerHTML = '<small style="color:var(--muted);padding:10px;">لا توجد حالات حالياً</small>';
    return;
  }

  container.innerHTML = db.stories.map(s => `
    <div class="story-item" onclick="viewStory(${s.id})">
      <div class="story-circle">
        ${s.type === 'image' ? `<img src="${s.content}">` : s.type === 'video' ? `<video src="${s.content}"></video>` : '📝'}
      </div>
      <span>${esc(s.userName)}</span>
    </div>
  `).join('');
}

function viewStory(id) {
  const s = db.stories.find(x => x.id === id);
  if (!s) return;
  document.getElementById('modalTitle').textContent = `حالة: ${s.userName}`;
  let body = '';
  if (s.type === 'text') body = `<p style="font-size:18px;text-align:center;padding:20px;">${esc(s.content)}</p>`;
  else if (s.type === 'image') body = `<img src="${s.content}" style="width:100%;border-radius:8px;">`;
  else if (s.type === 'video') body = `<video src="${s.content}" controls style="width:100%;border-radius:8px;"></video>`;

  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modal').classList.add('show');
}

// === نظام الدردشة والأصدقاء ===
function openAddFriendModal() {
  document.getElementById('modalTitle').textContent = 'إضافة صديق';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label>اسم المستخدم أو البريد</label>
      <input id="friendSearchInput" placeholder="أدخل بيانات المستخدم">
    </div>
    <button class="primary" onclick="addFriend()">إضافة</button>
  `;
  document.getElementById('modal').classList.add('show');
}

function addFriend() {
  const q = document.getElementById('friendSearchInput').value.trim();
  const user = getCurrentUser();
  const target = db.users.find(u => (u.name === q || u.email === q) && u.id !== user.id);

  if (!target) return toast('لم يتم العثور على المستخدم');
  if (!db.friends[user.id]) db.friends[user.id] = [];

  if (db.friends[user.id].includes(target.id)) return toast('المستخدم صديق بالفعل');

  db.friends[user.id].push(target.id);
  save();
  closeModal();
  renderFriends();
  toast('تمت إضافة الصديق بنجاح');
}

function renderFriends() {
  const user = getCurrentUser();
  const container = document.getElementById('friendsList');
  if (!container || !user) return;

  const myFriendIds = db.friends[user.id] || [];
  const myFriends = db.users.filter(u => myFriendIds.includes(u.id));

  if (myFriends.length === 0) {
    container.innerHTML = '<p class="empty">لا يوجد أصدقاء مضافون بعد</p>';
    return;
  }

  container.innerHTML = myFriends.map(f => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #eee;">
      <div><strong>👤 ${esc(f.name)}</strong></div>
      <button class="btn btn-green" onclick="openChatWith('${f.id}', '${esc(f.name)}')">دردشة 💬</button>
    </div>
  `).join('');
}

function openChatWith(friendId, friendName) {
  activeFriendId = friendId;
  document.getElementById('chatPartnerName').textContent = friendName;
  showScreen('chatRoom');
  renderChatMessages();
}

function sendTextMessage() {
  const input = document.getElementById('chatInputText');
  const txt = input.value.trim();
  if (!txt || !activeFriendId) return;

  saveChatMessage('text', txt);
  input.value = '';
}

function sendFileMessage(fileInput) {
  const file = fileInput.files[0];
  if (!file || !activeFriendId) return;

  let type = 'file';
  if (file.type.startsWith('image/')) type = 'image';
  else if (file.type.startsWith('video/')) type = 'video';
  else if (file.type.startsWith('audio/')) type = 'audio';

  const reader = new FileReader();
  reader.onload = () => {
    saveChatMessage(type, reader.result, file.name);
  };
  reader.readAsDataURL(file);
}

// تسجيل الصوت
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.start();
    document.getElementById('micBtn').style.color = 'red';
    toast('جاري تسجيل الصوت...');
  } catch (err) {
    toast('تعذر الوصول للميكروفون');
  }
}

function stopRecordingAndSend() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  document.getElementById('micBtn').style.color = 'inherit';
  mediaRecorder.onstop = () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const reader = new FileReader();
    reader.onloadend = () => saveChatMessage('audio', reader.result, 'صوتية.webm');
    reader.readAsDataURL(audioBlob);
  };
  mediaRecorder.stop();
}

function saveChatMessage(type, content, fileName = '') {
  const user = getCurrentUser();
  db.chats.push({
    id: Date.now(),
    senderId: user.id,
    receiverId: activeFriendId,
    type,
    content,
    fileName,
    timestamp: new Date().toLocaleTimeString('ar-SD', { hour: '2-digit', minute: '2-digit' })
  });
  save();
  renderChatMessages();
}

function renderChatMessages() {
  const user = getCurrentUser();
  const area = document.getElementById('chatMessagesArea');
  if (!area || !user || !activeFriendId) return;

  const relevantChats = db.chats.filter(c => 
    (c.senderId === user.id && c.receiverId === activeFriendId) ||
    (c.senderId === activeFriendId && c.receiverId === user.id)
  );

  area.innerHTML = relevantChats.map(c => {
    const isMe = c.senderId === user.id;
    let body = '';
    if (c.type === 'text') body = `<p>${esc(c.content)}</p>`;
    else if (c.type === 'image') body = `<img src="${c.content}" class="chat-media">`;
    else if (c.type === 'video') body = `<video src="${c.content}" controls class="chat-media"></video>`;
    else if (c.type === 'audio') body = `<audio src="${c.content}" controls></audio>`;
    else if (c.type === 'file') body = `<a href="${c.content}" download="${c.fileName}">📁 ${esc(c.fileName || 'تحميل الملف')}</a>`;

    return `
      <div class="message ${isMe ? 'sent' : 'received'}">
        ${body}
        <span class="chat-time">${c.timestamp}</span>
      </div>
    `;
  }).join('');
  
  area.scrollTop = area.scrollHeight;
}

// === إدارة المنتجات والأسواق والمفضلة ===
function productHTML(p) {
  const user = getCurrentUser();
  const isFav = user && db.favorites[user.id] && db.favorites[user.id].includes(p.id);

  return `<div class="product">
    <img class="product-img" src="${p.image || 'https://via.placeholder.com/150'}" alt="${esc(p.name)}" onerror="this.src='https://via.placeholder.com/150'">
    <div class="product-info">
      <h4>${esc(p.name)}</h4>
      <small>${esc(p.category)} • ${esc(p.market)} • ${esc(p.unit)}</small>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;">
      <div class="price">${money(p.price)}</div>
      <button class="fav" onclick="toggleFav(${p.id})">${isFav ? '❤️' : '♡'}</button>
    </div>
  </div>`;
}

function renderProducts() {
  const user = getCurrentUser();
  const searchInput = document.getElementById('searchInput')?.value || '';
  const productSearch = document.getElementById('productSearch')?.value || '';
  const q = (productSearch || searchInput).trim().toLowerCase();

  let arr = db.products.filter(p => (p.name + ' ' + p.category + ' ' + p.market).toLowerCase().includes(q));
  
  const home = document.getElementById('homeProducts');
  if (home) home.innerHTML = arr.slice(0, 4).map(productHTML).join('') || '<div class="empty">لا توجد نتائج</div>';
  
  const all = document.getElementById('allProducts');
  if (all) all.innerHTML = arr.map(productHTML).join('') || '<div class="empty">لا توجد منتجات</div>';
  
  const fav = document.getElementById('favProducts');
  if (fav) {
    const myFavIds = (user && db.favorites[user.id]) ? db.favorites[user.id] : [];
    const myFavProducts = db.products.filter(p => myFavIds.includes(p.id));
    fav.innerHTML = myFavProducts.map(productHTML).join('') || '<div class="empty">لم تضف منتجات للمفضلة بعد ❤️</div>';
  }
}

function toggleFav(id) {
  const user = getCurrentUser();
  if (!user) return toast('سجل الدخول أولاً');
  if (!db.favorites[user.id]) db.favorites[user.id] = [];

  const index = db.favorites[user.id].indexOf(id);
  if (index > -1) db.favorites[user.id].splice(index, 1);
  else db.favorites[user.id].push(id);

  save();
  renderAll();
  toast('تم تحديث المفضلة الخاصة بك');
}

function renderMarkets() {
  const cards = db.markets.map(m => `
    <div class="market" style="background-image: url('${m.image}');height:100px;background-size:cover;border-radius:8px;margin-bottom:8px;display:flex;align-items:flex-end;padding:8px;color:#fff;font-weight:bold;text-shadow:0 1px 3px rgba(0,0,0,0.8);" onclick="marketProducts('${esc(m.name)}')">
      ${esc(m.name)} - ${esc(m.city)}
    </div>`).join('');

  const homeMarkets = document.getElementById('marketHome');
  if (homeMarkets) homeMarkets.innerHTML = cards;
  const allMarkets = document.getElementById('allMarkets');
  if (allMarkets) allMarkets.innerHTML = cards || '<div class="empty">لا توجد أسواق</div>';
}

function filterCategory(cat) { showScreen('products'); const x = document.getElementById('productSearch'); if (x) { x.value = cat; renderProducts(); } }
function marketProducts(m) { showScreen('products'); const x = document.getElementById('productSearch'); if (x) { x.value = m; renderProducts(); } }

function openProductModal(id = null) {
  if (!isAdmin()) return toast('خاص بالمدير فقط');
  const p = typeof id === 'number' ? db.products.find(x => x.id === id) : null;
  document.getElementById('modalTitle').textContent = p ? 'تعديل منتج' : 'إضافة منتج';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label>اسم المنتج</label><input id="mName" value="${p ? esc(p.name) : ''}"></div>
    <div class="form-group"><label>القسم</label><select id="mCat"><option>خضروات</option><option>فواكه</option><option>لحوم</option><option>حبوب</option></select></div>
    <div class="form-group"><label>السعر</label><input id="mPrice" type="number" value="${p ? p.price : ''}"></div>
    <div class="form-group"><label>الوحدة</label><input id="mUnit" value="${p ? esc(p.unit) : 'كيلو'}"></div>
    <div class="form-group"><label>السوق</label><select id="mMarket">${db.markets.map(m => `<option>${esc(m.name)}</option>`).join('')}</select></div>
    <button class="primary" onclick="saveProduct(${id || 0})">حفظ</button>`;
  document.getElementById('modal').classList.add('show');
}

function saveProduct(id) {
  const name = document.getElementById('mName').value.trim();
  const price = Number(document.getElementById('mPrice').value);
  if (!name || !price) return toast('أدخل البيانات');

  const data = { name, category: document.getElementById('mCat').value, price, unit: document.getElementById('mUnit').value, market: document.getElementById('mMarket').value, image: 'https://via.placeholder.com/150' };
  if (id) Object.assign(db.products.find(p => p.id === id), data);
  else db.products.push({ ...data, id: Date.now() });

  save(); closeModal(); renderAll();
}

function openMarketModal() {
  if (!isAdmin()) return toast('خاص بالمدير فقط');
  document.getElementById('modalTitle').textContent = 'إضافة سوق';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label>اسم السوق</label><input id="marketName"></div>
    <div class="form-group"><label>المدينة</label><input id="marketCity" value="الخرطوم"></div>
    <button class="primary" onclick="saveMarket()">إضافة</button>`;
  document.getElementById('modal').classList.add('show');
}

function saveMarket() {
  const name = document.getElementById('marketName').value.trim();
  if (!name) return;
  db.markets.push({ id: Date.now(), name, city: document.getElementById('marketCity').value, image: 'https://via.placeholder.com/500' });
  save(); closeModal(); renderAll();
}

function closeModal() { document.getElementById('modal').classList.remove('show'); }

function login() {
  const input = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;

  if ((input === 'أنس' || input === 'anas@market.com') && pass === '12345') {
    let admin = db.users.find(u => u.name === 'أنس');
    if (!admin) { admin = ADMIN_USER; db.users.push(admin); }
    db.currentUser = admin;
    save(); showScreen('home'); toast('أهلاً مدير النظام أنس'); return;
  }

  const user = db.users.find(u => (u.name === input || u.email === input) && u.password === pass);
  if (user) { db.currentUser = user; save(); showScreen('home'); toast(`مرحباً ${user.name}`); }
  else toast('بيانات الدخول خاطئة');
}

function openRegister() {
  document.getElementById('modalTitle').textContent = 'حساب جديد';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label>الاسم</label><input id="rName"></div>
    <div class="form-group"><label>البريد</label><input id="rEmail"></div>
    <div class="form-group"><label>كلمة المرور</label><input id="rPass" type="password"></div>
    <button class="primary" onclick="register()">إنشاء الحساب</button>`;
  document.getElementById('modal').classList.add('show');
}

function register() {
  const name = document.getElementById('rName').value.trim();
  const email = document.getElementById('rEmail').value.trim();
  const password = document.getElementById('rPass').value;
  if (!name || !email || !password) return toast('أكمل البيانات');

  const user = { id: 'u_' + Date.now(), name, email, password, role: 'user' };
  db.users.push(user);
  db.currentUser = user;
  save(); closeModal(); showScreen('home');
}

function logout() { db.currentUser = null; save(); showScreen('login'); }

function updateProfile() {
  const u = getCurrentUser();
  if (document.getElementById('profileName')) document.getElementById('profileName').textContent = u ? u.name : '';
  if (document.getElementById('profileEmail')) document.getElementById('profileEmail').textContent = u ? u.email : '';
  if (document.getElementById('adminPanelBtn')) document.getElementById('adminPanelBtn').style.display = isAdmin() ? 'block' : 'none';
}

function renderAdmin() {
  if (!isAdmin() || !document.getElementById('statProducts')) return;
  document.getElementById('statProducts').textContent = db.products.length;
  document.getElementById('statMarkets').textContent = db.markets.length;
  document.getElementById('statUsers').textContent = db.users.length;
}

function renderAll() {
  document.querySelectorAll('.bottom-nav').forEach(n => n.innerHTML = navHTML());
  renderMarkets();
  renderProducts();
  renderStories();
  renderFriends();
  renderAdmin();
  updateProfile();
}

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])); }

if (!getCurrentUser()) showScreen('login');
else renderAll();

