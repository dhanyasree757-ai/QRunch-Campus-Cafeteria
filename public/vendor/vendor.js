```javascript
let orders = [];
let activeStatus = 'All';

const $ = id => document.getElementById(id);
const statuses = ['New', 'Preparing', 'Ready', 'Collected'];

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function nextStatus(status) {
  const i = statuses.indexOf(status);
  return i < 0 ? null : (statuses[i + 1] || null);
}

function updateStats() {
  for (const status of statuses) {
    const id = {
      New: 'newCount',
      Preparing: 'preparingCount',
      Ready: 'readyCount',
      Collected: 'collectedCount'
    }[status];

    if ($(id)) {
      $(id).textContent = orders.filter(o => o.status === status).length;
    }
  }
}

async function loadOrders() {
  const message = $('orderMessage');

  try {
    if (message) message.textContent = 'Loading orders...';

    const data = await QR_API.request('/api/orders');

    if (!data || !Array.isArray(data.orders)) {
      throw new Error('Server returned an invalid orders response.');
    }

    orders = data.orders;
    renderOrders();

    if (message) {
      message.textContent = orders.length
        ? `${orders.length} order(s) loaded from the server.`
        : 'No orders received from the server. Check whether the student order was saved successfully.';
    }
  } catch (err) {
    if (message) {
      message.textContent = `Could not load orders: ${err.message}`;
    }

    $('orderList').innerHTML = `
      <div class="empty">
        <h3>Unable to load orders</h3>
        <p>${escapeHTML(err.message)}</p>
        <button type="button" id="retryOrders">Try again</button>
      </div>
    `;

    orders = [];
    updateStats();
    $('resultCount').textContent = '0 orders found';
  }
}

function renderOrders() {
  const query = $('search').value.trim().toLowerCase();
  const sort = $('sort').value;

  const filtered = orders.filter(o => {
    const searchable = [
      o.id,
      o.student,
      o.studentId,
      o.code,
      o.pickupTime,
      o.pickup_time,
      ...(o.items || []).map(i => i.name)
    ].join(' ').toLowerCase();

    return searchable.includes(query) &&
      (activeStatus === 'All' || o.status === activeStatus);
  });

  filtered.sort((a, b) => {
    const dateA = String(a.createdAt || '');
    const dateB = String(b.createdAt || '');

    return sort === 'newest'
      ? dateB.localeCompare(dateA)
      : dateA.localeCompare(dateB);
  });

  $('resultCount').textContent =
    `${filtered.length} order${filtered.length === 1 ? '' : 's'} found`;

  $('orderList').innerHTML = filtered.length
    ? filtered.map(o => {
        const next = nextStatus(o.status);

        const items = (o.items || []).map(i =>
          `${escapeHTML(i.name)} × ${escapeHTML(i.qty)}`
        ).join(', ');

        const pickupTime = o.pickupTime || o.pickup_time || 'Not available';

        return `
          <article class="order">
            <div>
              <h3>Order: ${escapeHTML(o.id)}</h3>

              <p>
                Student: ${escapeHTML(o.student || 'Student')}
                · Pickup code:
                <strong>${escapeHTML(o.code || 'N/A')}</strong>
              </p>

              <p>
                <strong>Pickup time:</strong>
                ${escapeHTML(pickupTime)}
              </p>

              <p><strong>Items:</strong> ${items || 'No items listed'}</p>

              <p><strong>Total:</strong> ₹${escapeHTML(o.total ?? 0)}</p>

              <span class="status ${escapeHTML(
                String(o.status || '').toLowerCase()
              )}">
                ${escapeHTML(o.status || 'Unknown')}
              </span>
            </div>

            <div class="order-actions">
              ${
                next
                  ? `<button type="button"
                       data-action="advance"
                       data-id="${escapeHTML(o.id)}">
                       ${
                         next === 'Preparing'
                           ? 'Accept & prepare'
                           : next === 'Ready'
                             ? 'Mark ready'
                             : 'Mark collected'
                       }
                     </button>`
                  : '<span class="muted">Order complete</span>'
              }
            </div>
          </article>
        `;
      }).join('')
    : `
      <div class="empty">
        <h3>No orders found</h3>
        <p>Try clearing the search or selecting All.</p>
      </div>
    `;

  updateStats();
}

$('search').addEventListener('input', renderOrders);
$('sort').addEventListener('change', renderOrders);

$('filters').addEventListener('click', e => {
  const button = e.target.closest('[data-status]');
  if (!button) return;

  activeStatus = button.dataset.status;

  document.querySelectorAll('.filter').forEach(filter => {
    const active = filter === button;
    filter.classList.toggle('active', active);
    filter.setAttribute('aria-pressed', String(active));
  });

  renderOrders();
});

$('orderList').addEventListener('click', async e => {
  if (e.target.closest('#retryOrders')) {
    await loadOrders();
    return;
  }

  const button = e.target.closest('[data-action="advance"]');
  if (!button) return;

  const order = orders.find(o => String(o.id) === button.dataset.id);
  if (!order) return;

  const next = nextStatus(order.status);
  if (!next) return;

  let pickupCode;

  if (next === 'Collected') {
    pickupCode = prompt(`Enter pickup code for order ${order.id}:`);
    if (pickupCode === null) return;
  }

  button.disabled = true;

  try {
    await QR_API.request(
      `/api/orders/${encodeURIComponent(order.id)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: next, pickupCode })
      }
    );

    await loadOrders();
  } catch (err) {
    alert(err.message || 'Could not update order status.');
    button.disabled = false;
  }
});

$('pickupForm').addEventListener('submit', async e => {
  e.preventDefault();

  const code = $('pickupCode').value.trim();
  const message = $('pickupMessage');

  try {
    message.textContent = 'Verifying pickup code...';

    const result = await QR_API.request('/api/pickup/verify', {
      method: 'POST',
      body: JSON.stringify({ code })
    });

    message.textContent = result.message || 'Pickup verified.';
    $('pickupCode').value = '';

    await loadOrders();
  } catch (err) {
    message.textContent = err.message || 'Pickup verification failed.';
  }
});

$('resetButton').addEventListener('click', () => {
  alert('Reset is disabled to protect your saved database orders.');
});

document.querySelectorAll('.filter').forEach(button => {
  button.setAttribute(
    'aria-pressed',
    String(button.dataset.status === 'All')
  );
});

const logoutButton = $('vendorLogout');

if (logoutButton) {
  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('qrunch_token');
    localStorage.removeItem('qrunch_user');
    window.location.href = '/';
  });
}

(async () => {
  try {
    await QR_API.signIn('vendor');
    await loadOrders();
  } catch (err) {
    const message = $('orderMessage');

    if (message) {
      message.textContent =
        `Vendor login/API error: ${err.message || 'Please log in again.'}`;
    }

    $('orderList').innerHTML = `
      <div class="empty">
        <h3>Vendor login required</h3>
        <p>${escapeHTML(err.message || 'Please log in again.')}</p>
      </div>
    `;
  }
})();
```
