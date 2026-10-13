let dishes = [
  {id:1,name:'Paneer Rice Bowl',category:'Meals',price:85,emoji:'🍛',rating:'4.8',description:'Soft paneer, rice & a flavourful masala',badge:'STUDENT FAV',available:true},
  {id:2,name:'Veg Cheese Sandwich',category:'Snacks',price:55,emoji:'🥪',rating:'4.7',description:'Toasted bread, veggies & melted cheese',badge:'BESTSELLER',available:true},
  {id:3,name:'Cold Coffee',category:'Drinks',price:40,emoji:'🥤',rating:'4.6',description:'Chilled, creamy and just the right kick',badge:'CHILL PICK',available:true},
  {id:4,name:'Masala Dosa',category:'Meals',price:60,emoji:'🥞',rating:'4.9',description:'Crispy dosa served with chutney',badge:'POPULAR',available:true},
  {id:5,name:'Fresh Fruit Bowl',category:'Healthy',price:50,emoji:'🥗',rating:'4.5',description:'A refreshing mix of seasonal fruits',badge:'FRESH',available:true},
  {id:6,name:'Samosa Duo',category:'Snacks',price:25,emoji:'🥟',rating:'4.7',description:'Two crispy, spicy potato samosas',badge:'QUICK BITE',available:true},
  {id:7,name:'Lemon Mint Cooler',category:'Drinks',price:30,emoji:'🍹',rating:'4.6',description:'Fresh lemon with a minty twist',badge:'REFRESHING',available:true},
  {id:8,name:'Veg Fried Rice',category:'Meals',price:75,emoji:'🍚',rating:'4.8',description:'Wok-tossed rice with crunchy vegetables',badge:'CHEF PICK',available:true},
  {id:9,name:'Veg Burger',category:'Snacks',price:60,emoji:'🍔',rating:'4.8',description:'Fresh veggies, special sauce',badge:'POPULAR',available:true},
  {id:10,name:'Chicken Burger',category:'Snacks',price:80,emoji:'🍔',rating:'4.7',description:'Juicy burger with signature sauce',badge:'BESTSELLER',available:true},
  {id:11,name:'French Fries',category:'Snacks',price:40,emoji:'🍟',rating:'4.6',description:'Crispy and golden fries',badge:'QUICK BITE',available:true},
  {id:12,name:'Pizza',category:'Meals',price:120,emoji:'🍕',rating:'4.9',description:'Loaded with veggies and cheese',badge:'POPULAR',available:true},
  {id:13,name:'Chocolate Pancakes',category:'Desserts',price:70,emoji:'🥞',rating:'4.7',description:'Fluffy pancakes with chocolate drizzle',badge:'SWEET PICK',available:true},
  {id:14,name:'Mango Smoothie',category:'Drinks',price:45,emoji:'🥭',rating:'4.6',description:'Cool mango smoothie',badge:'FRESH',available:true},
  {id:15,name:'Idli Sambar',category:'Meals',price:45,emoji:'🍘',rating:'4.7',description:'Soft idlis with warm sambar',badge:'CLASSIC',available:true},
  {id:16,name:'Veg Wrap',category:'Healthy',price:65,emoji:'🌯',rating:'4.6',description:'Crunchy vegetables in a soft wrap',badge:'FRESH',available:true}
];
let cart = [];
let selectedCategory = 'All';
let favorites = new Set();
let orders = [];
let toastTimer;
const $ = id => document.getElementById(id);
const money = value => `₹${value}`;
const safeText = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderMenu(targetId='menu-grid', list=null){
  const target=$(targetId); if(!target)return;
  const search=$('search-input').value.trim().toLowerCase();
  const items=(list || dishes.filter(d=>(selectedCategory==='All'||d.category===selectedCategory)&&(`${d.name} ${d.description} ${d.category}`).toLowerCase().includes(search)));
  target.innerHTML=items.map(d=>`<article class="food-card"><div class="food-image ${d.category.toLowerCase()}"><span class="food-badge">${d.badge}</span><span class="food-emoji" role="img" aria-label="${safeText(d.name)}">${d.emoji}</span><button class="heart-btn ${favorites.has(d.id)?'favorited':''}" data-favorite="${d.id}" aria-label="${favorites.has(d.id)?'Remove from':'Add to'} favorites">${favorites.has(d.id)?'♥':'♡'}</button></div><div class="food-details"><div class="food-title-row"><h3>${safeText(d.name)}</h3><span class="rating">★ ${d.rating}</span></div><p class="food-description">${safeText(d.description)}</p><div class="food-bottom"><span class="price">${money(d.price)} <small>/ item</small></span><button class="add-btn" data-add="${d.id}">＋ Add</button></div><div class="stock-note">● Available now</div></div></article>`).join('');
  if(targetId==='menu-grid') $('empty-state').classList.toggle('hidden',items.length>0);
}
function updateCart(){
 const count=cart.reduce((n,i)=>n+i.qty,0), total=cart.reduce((n,i)=>n+i.qty*dishes.find(d=>d.id===i.id).price,0);
 $('cart-count').textContent=count; $('drawer-item-count').textContent=`(${count})`; $('nav-order-count').textContent=orders.length;
 $('cart-items').innerHTML=cart.map(i=>{const d=dishes.find(x=>x.id===i.id);return `<div class="cart-row"><div class="cart-row-image">${d.emoji}</div><div class="cart-row-main"><b>${safeText(d.name)}</b><small>${money(d.price)} each</small><div class="cart-row-bottom"><span class="price">${money(d.price*i.qty)}</span><div class="qty-control"><button data-qty="${d.id}" data-change="-1" aria-label="Decrease quantity">−</button><b>${i.qty}</b><button data-qty="${d.id}" data-change="1" aria-label="Increase quantity">+</button></div></div></div></div>`}).join('');
 $('cart-empty').classList.toggle('hidden',count>0); $('cart-footer').classList.toggle('hidden',count===0); $('cart-subtotal').textContent=money(total); $('cart-total').textContent=money(total); updateFloatingCart();
}
function updateFloatingCart(){
 const bar=$('floating-cart-bar');
 const count=cart.reduce((n,i)=>n+i.qty,0);
 const total=cart.reduce((n,i)=>n+i.qty*(dishes.find(d=>d.id===i.id)?.price||0),0);
 if(!bar)return;
 bar.classList.toggle('hidden',count===0);
 $('floating-cart-count').textContent=`${count} item${count===1?'':'s'}`;
 $('floating-cart-total').textContent=money(total);
}
function addToCart(id){const item=cart.find(i=>i.id===id);if(item)item.qty++;else cart.push({id,qty:1});updateCart();showToast(`${dishes.find(d=>d.id===id).name} added to cart`)}
function changeQty(id,delta){const item=cart.find(i=>i.id===id);if(!item)return;item.qty+=delta;if(item.qty<=0)cart=cart.filter(i=>i.id!==id);updateCart()}
function showToast(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2300)}
function openCart(){ $('overlay').classList.remove('hidden');$('cart-drawer').classList.add('open');$('cart-drawer').setAttribute('aria-hidden','false');document.body.style.overflow='hidden'; }
function closeCart(){ $('overlay').classList.add('hidden');$('cart-drawer').classList.remove('open');$('cart-drawer').setAttribute('aria-hidden','true');document.body.style.overflow=''; }
function showSection(section){
 const sections={home:$('discover-section'),orders:$('orders-section'),favorites:$('favorites-section'),profile:$('profile-section')};Object.entries(sections).forEach(([key,el])=>el.classList.toggle('hidden',key!==section));
 document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===section));
 $('breadcrumb-current').textContent=section==='home'?'Discover food':section==='orders'?'My orders':section==='profile'?'Profile':'Favorites';
 if(section==='orders')renderOrders();if(section==='profile')renderProfile();if(section==='favorites'){const favs=dishes.filter(d=>favorites.has(d.id));renderMenu('favorite-grid',favs);$('favorites-empty').classList.toggle('hidden',favs.length>0)}
 $('sidebar').classList.remove('mobile-open');window.scrollTo({top:0,behavior:'smooth'});
}
function renderOrders(){ 
 $('order-history').innerHTML=orders.length?orders.map(o=>{const itemText=(o.items||[]).map(i=>`${i.qty} × ${i.name || (dishes.find(d=>d.id===i.id)||{}).name || 'Item'}`).join(', ');const age=Math.max(0,(Date.now()-new Date(String(o.createdAt||'').replace(' ','T')+'Z').getTime())/60000);const canCancel=o.status==='New'&&age<=10;return `<article class="history-card"><div class="history-emoji">🍽️</div><div class="history-main"><h3>Order ${safeText(o.id)}</h3><p>${safeText(itemText)} · ${safeText(o.pickupTime||'')}</p><div class="pickup-inline">Pickup code: <b>${safeText(o.code||'')}</b></div>${canCancel?`<p class="cancel-note">Cancel available for ${Math.max(0,Math.ceil(10-age))} more minute(s).</p><button class="cancel-order-btn" data-cancel-order="${safeText(o.id)}">Cancel order</button>`:''}</div><span class="history-status ${o.status==='Ready'?'ready':''}">${safeText(o.status)}</span><strong class="history-total">${money(o.total)}</strong></article>`}).join(''):'<div class="empty-state"><div>🧾</div><h3>No orders yet</h3><p>Your placed orders will show up here.</p></div>'; 
}
let cancelCountdownInterval=null;
let activeSuccessOrder=null;
async function placeOrder(event){
 if(event)event.preventDefault();
 if(!cart.length)return;
 const orderItems=cart.map(i=>({id:i.id,qty:i.qty}));
 try {
   await QR_API.signIn('student');
   const result=await QR_API.request('/api/orders',{method:'POST',body:JSON.stringify({items:orderItems,pickupTime:'As soon as possible (10–15 min)'})});
   const o=result.order;
   orders.unshift(o); activeSuccessOrder=o;
   $('pickup-code').textContent=o.code;
   $('pickup-qr').innerHTML='';
   if(window.QRCode) new QRCode($('pickup-qr'), {text:o.code, width:144, height:144});
   $('success-summary').textContent=`${o.items.reduce((n,i)=>n+i.qty,0)} item(s) · ${money(o.total)} · ${o.pickupTime}`;
   cart=[]; updateCart(); closeCart();
   $('success-modal').classList.remove('hidden');
   startCancelCountdown(o);
   await loadMyOrders();
 } catch(err) { alert(err.message || 'Could not place order.'); }
}
function startCancelCountdown(order){
 clearInterval(cancelCountdownInterval);
 const button=$('success-cancel-order'), timer=$('cancel-countdown'), note=$('cancel-timer-note');
 const created=Date.parse(String(order.createdAt||'').replace(' ','T')+'Z') || Date.now();
 const update=()=>{
   const remaining=Math.max(0,600000-(Date.now()-created));
   const current=orders.find(o=>o.id===order.id)||order;
   const allowed=current.status==='New' && remaining>0;
   button.classList.toggle('hidden',!allowed);
   note.classList.toggle('hidden',!allowed);
   if(allowed){const mins=Math.floor(remaining/60000),secs=Math.floor((remaining%60000)/1000);timer.textContent=`${mins}:${String(secs).padStart(2,'0')}`;}
   if(!allowed){clearInterval(cancelCountdownInterval);cancelCountdownInterval=null;}
 };
 update(); cancelCountdownInterval=setInterval(update,1000);
}
async function cancelSuccessOrder(){
 const order=activeSuccessOrder;if(!order)return;
 try{
  await QR_API.request('/api/orders/'+encodeURIComponent(order.id)+'/cancel',{method:'POST'});
  activeSuccessOrder={...order,status:'Cancelled'};
  const found=orders.find(o=>o.id===order.id);if(found)found.status='Cancelled';
  clearInterval(cancelCountdownInterval);cancelCountdownInterval=null;
  $('success-cancel-order').classList.add('hidden');$('cancel-timer-note').classList.add('hidden');
  showToast('Order cancelled successfully');await loadMyOrders();
 }catch(err){alert(err.message||'Could not cancel order.');await loadMyOrders();}
}
async function loadMenuFromAPI(){
 try { const result=await QR_API.request('/api/menu'); const serverItems=result.items.filter(d=>d.available); const known=new Set(serverItems.map(d=>Number(d.id))); dishes=[...serverItems,...dishes.filter(d=>!known.has(Number(d.id)))]; renderMenu(); }
 catch(err){ console.error(err); }
}
async function loadMyOrders(){
 try { const result=await QR_API.request('/api/orders/mine'); orders=result.orders; renderOrders(); $('nav-order-count').textContent=orders.length; }
 catch(err){ console.error(err); }
}

document.addEventListener('click',async e=>{const cancel=e.target.closest('[data-cancel-order]');if(cancel){if(!confirm('Cancel this order? Cancellation is allowed only within 10 minutes, while the order is still New.'))return;try{await QR_API.request('/api/orders/'+encodeURIComponent(cancel.dataset.cancelOrder)+'/cancel',{method:'POST'});await loadMyOrders();showToast('Order cancelled');}catch(err){alert(err.message)}return;}const add=e.target.closest('[data-add]');if(add){addToCart(Number(add.dataset.add));return}const qty=e.target.closest('[data-qty]');if(qty){changeQty(Number(qty.dataset.qty),Number(qty.dataset.change));return}const fav=e.target.closest('[data-favorite]');if(fav){const id=Number(fav.dataset.favorite);favorites.has(id)?favorites.delete(id):favorites.add(id);renderMenu();if(!$('favorites-section').classList.contains('hidden')){renderMenu('favorite-grid',dishes.filter(d=>favorites.has(d.id)));$('favorites-empty').classList.toggle('hidden',favorites.size>0)}return}const nav=e.target.closest('[data-nav]');if(nav){e.preventDefault();showSection(nav.dataset.nav)}});
$('category-row').addEventListener('click',e=>{const chip=e.target.closest('[data-category]');if(!chip)return;selectedCategory=chip.dataset.category;document.querySelectorAll('.category-chip').forEach(c=>c.classList.toggle('active',c===chip));renderMenu()});
$('search-input').addEventListener('input',()=>renderMenu());$('clear-search').addEventListener('click',()=>{$('search-input').value='';selectedCategory='All';document.querySelectorAll('.category-chip').forEach(c=>c.classList.toggle('active',c.dataset.category==='All'));renderMenu()});
$('cart-open').addEventListener('click',openCart);$('cart-close').addEventListener('click',closeCart);$('overlay').addEventListener('click',closeCart);
$('checkout-btn').addEventListener('click',placeOrder);$('floating-confirm-order').addEventListener('click',placeOrder);
$('success-close').addEventListener('click',()=>$('success-modal').classList.add('hidden'));
function getCurrentUser(){try{return JSON.parse(localStorage.getItem('qrunch_user')||'null')||{name:'Student',email:'',id:''}}catch{return {name:'Student',email:'',id:''}}}
function initials(name){return String(name||'Student').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'ST'}
function renderProfile(){const u=getCurrentUser();const name=u.name||u.fullName||'Student';$('sidebar-user-name').textContent=name;$('sidebar-avatar').textContent=initials(name);$('profile-avatar').textContent=initials(name);$('profile-name').textContent=name;$('profile-email').textContent=u.email||'Email not available';$('profile-id').textContent='Customer ID: '+(u.studentId||u.student_id||u.id||'—')}
function logoutStudent(){localStorage.removeItem('qrunch_token');localStorage.removeItem('qrunch_user');window.location.replace('/')}
function openContact(){ $('contact-modal').classList.remove('hidden') }
$('contact-cafeteria').addEventListener('click',e=>{e.preventDefault();openContact()});$('profile-contact').addEventListener('click',openContact);$('contact-close').addEventListener('click',()=>$('contact-modal').classList.add('hidden'));$('contact-done').addEventListener('click',()=>$('contact-modal').classList.add('hidden'));$('student-logout').addEventListener('click',e=>{e.preventDefault();logoutStudent()});$('profile-logout').addEventListener('click',logoutStudent);$('profile-options').addEventListener('click',()=>showSection('profile'));$('profile-orders').addEventListener('click',()=>showSection('orders'));
$('success-cancel-order').addEventListener('click',cancelSuccessOrder);$('view-orders').addEventListener('click',()=>{$('success-modal').classList.add('hidden');showSection('orders')});$('back-to-menu').addEventListener('click',()=>showSection('home'));$('browse-food').addEventListener('click',()=>showSection('home'));$('mobile-menu').addEventListener('click',()=>$('sidebar').classList.toggle('mobile-open'));
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('search-input').focus()}if(e.key==='Escape'){closeCart();$('success-modal').classList.add('hidden');$('sidebar').classList.remove('mobile-open')}});
renderMenu();updateCart();renderProfile();
(async()=>{try{await QR_API.signIn('student'); await loadMenuFromAPI(); await loadMyOrders();}catch(err){alert(err.message || 'Student sign-in failed.');}})();
