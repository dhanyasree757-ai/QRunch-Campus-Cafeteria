
let orders=[]; let activeStatus='All';
const $=id=>document.getElementById(id);
const statuses=['New','Preparing','Ready','Collected'];
function escapeHTML(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function nextStatus(status){const i=statuses.indexOf(status);return i<0?null:(statuses[i+1]||null)}
function updateStats(){
 for(const status of statuses){
  const id=status==='New'?'newCount':status==='Preparing'?'preparingCount':status==='Ready'?'readyCount':'collectedCount';
  $(id).textContent=orders.filter(o=>o.status===status).length;
 }
}
async function loadOrders(){
 const data=await QR_API.request('/api/orders');
 orders=data.orders;
 renderOrders();
}
function renderOrders(){
 const query=$('search').value.trim().toLowerCase(), sort=$('sort').value;
 const filtered=orders.filter(o=>[o.id,o.student,o.code,...(o.items||[]).map(i=>i.name)].join(' ').toLowerCase().includes(query)&&(activeStatus==='All'||o.status===activeStatus));
 filtered.sort((a,b)=>sort==='newest'?String(b.createdAt).localeCompare(String(a.createdAt)):String(a.createdAt).localeCompare(String(b.createdAt)));
 $('resultCount').textContent=`${filtered.length} order${filtered.length===1?'':'s'} found`;
 $('orderList').innerHTML=filtered.length?filtered.map(o=>{
  const next=nextStatus(o.status);
  const items=(o.items||[]).map(i=>`${escapeHTML(i.name)} × ${i.qty}`).join(', ');
  return `<article class="order"><div><h3>${escapeHTML(o.id)}</h3><p>${escapeHTML(o.student)} · Pickup code: <strong>${escapeHTML(o.code)}</strong></p><p>${items}</p><p><strong>₹${o.total}</strong></p><span class="status ${o.status.toLowerCase()}">${escapeHTML(o.status)}</span></div><div class="order-actions">${next?`<button data-action="advance" data-id="${escapeHTML(o.id)}">${next==='Preparing'?'Accept & prepare':next==='Ready'?'Mark ready':'Mark collected'}</button>`:'<span class="muted">Order complete</span>'}</div></article>`;
 }).join(''):`<div class="empty"><h3>No orders found</h3><p>Orders placed by students will appear here.</p></div>`;
 updateStats();
}
$('search').addEventListener('input',renderOrders);
$('sort').addEventListener('change',renderOrders);
$('filters').addEventListener('click',e=>{
 const b=e.target.closest('[data-status]'); if(!b)return;
 activeStatus=b.dataset.status;
 document.querySelectorAll('.filter').forEach(f=>{const active=f===b;f.classList.toggle('active',active);f.setAttribute('aria-pressed',String(active))});
 renderOrders();
});
$('orderList').addEventListener('click',async e=>{
 const b=e.target.closest('[data-action="advance"]'); if(!b)return;
 const order=orders.find(o=>o.id===b.dataset.id); if(!order)return;
 const next=nextStatus(order.status); if(!next)return;
 let pickupCode;
 if(next==='Collected'){pickupCode=prompt(`Enter pickup code for ${order.id}:`);if(pickupCode===null)return;}
 try{
  await QR_API.request(`/api/orders/${encodeURIComponent(order.id)}/status`,{method:'PATCH',body:JSON.stringify({status:next,pickupCode})});
  await loadOrders();
 }catch(err){alert(err.message);}
});
$('pickupForm').addEventListener('submit',async e=>{
 e.preventDefault(); const code=$('pickupCode').value.trim();
 try{
  const result=await QR_API.request('/api/pickup/verify',{method:'POST',body:JSON.stringify({code})});
  $('pickupMessage').textContent=result.message; $('pickupCode').value=''; await loadOrders();
 }catch(err){$('pickupMessage').textContent=err.message;}
});
$('resetButton').addEventListener('click',()=>alert('Demo reset is disabled for database-backed orders. Orders are stored in SQLite.'));
document.querySelectorAll('.filter').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.status==='All')));
(async()=>{try{await QR_API.signIn('vendor');await loadOrders();}catch(err){alert(err.message||'Vendor sign-in failed.');}})();
