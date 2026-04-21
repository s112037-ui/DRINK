const menuData = [
    { id: 1, name: '招牌珍珠奶茶', nameEn: 'Signature Boba', price: 65, icon: '🧋' },
    { id: 2, name: '極品宇治抹茶', nameEn: 'Matcha Latte', price: 80, icon: '🍵' },
    { id: 3, name: '百香雙響炮', nameEn: 'Passion Fruit Tea', price: 60, icon: '🍹' },
    { id: 4, name: '黑糖鮮奶', nameEn: 'Brown Sugar Milk', price: 75, icon: '🥛' },
    { id: 5, name: '冷萃烏龍茶', nameEn: 'Cold Brew Oolong', price: 40, icon: '🧊' },
    { id: 6, name: '鮮榨葡萄柚綠', nameEn: 'Grapefruit Green', price: 70, icon: '🍊' },
    { id: 7, name: '仲夏芒果冰沙', nameEn: 'Mango Slush', price: 90, icon: '🥭' },
    { id: 8, name: '荔枝氣泡飲', nameEn: 'Lychee Fizz', price: 65, icon: '🥤' }
];

let cart = [];

// DOM Elements
const menuGrid = document.getElementById('menu-grid');
const cartItems = document.getElementById('cart-items');
const totalPriceEl = document.getElementById('total-price');
const checkoutBtn = document.getElementById('checkout-btn');
const backendStatus = document.getElementById('backend-status');

// Backend URL
const API_URL = 'http://localhost:5000/api/checkout';

// Check backend status periodically
async function checkBackend() {
    try {
        const ping = await fetch('http://localhost:5000/api/ping', { method: 'GET' });
        if(ping.ok) {
            backendStatus.classList.add('connected');
            backendStatus.innerHTML = '<i class="ri-checkbox-circle-line"></i> 後端已連線';
        }
    } catch (e) {
        backendStatus.classList.remove('connected');
        backendStatus.innerHTML = '<i class="ri-error-warning-line"></i> 後端未連線 (請開啟 python app.py)';
    }
}
setInterval(checkBackend, 5000);
checkBackend();

// Render Menu
function renderMenu() {
    menuGrid.innerHTML = menuData.map(item => `
        <div class="menu-item" onclick="addToCart(${item.id})">
            <div class="item-icon">${item.icon}</div>
            <div class="item-name">${item.name}</div>
            <div class="item-price">$${item.price}</div>
            <button class="add-btn">加入訂單</button>
        </div>
    `).join('');
}

// Add to Cart
window.addToCart = function(id) {
    const item = menuData.find(i => i.id === id);
    const existing = cart.find(i => i.id === id);
    
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...item, quantity: 1 });
    }
    
    updateCartUI();
}

// Update quantity
window.updateQty = function(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    
    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(i => i.id !== id);
    }
    
    updateCartUI();
}

// Update Cart UI
function updateCartUI() {
    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="empty-cart">
                <i class="ri-shopping-cart-2-line"></i>
                <p>訂單是空的</p>
            </div>
        `;
        checkoutBtn.disabled = true;
    } else {
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <span class="cart-item-name">${item.name}</span>
                    <span class="cart-item-price">$${item.price} x ${item.quantity}</span>
                </div>
                <div class="cart-item-actions">
                    <button class="qty-btn" onclick="updateQty(${item.id}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="qty-btn" onclick="updateQty(${item.id}, 1)">+</button>
                </div>
            </div>
        `).join('');
        checkoutBtn.disabled = false;
    }
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    totalPriceEl.innerText = `$${total}`;
}

// Checkout Flow - Connecting to Backend and waiting for Cashier
checkoutBtn.addEventListener('click', async () => {
    if (cart.length === 0) return;
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Show loading modal
    const modal = document.getElementById('payment-modal');
    const spinner = document.getElementById('payment-spinner');
    const successIcon = document.getElementById('payment-success');
    const statusText = document.getElementById('payment-status');
    const messageText = document.getElementById('payment-message');
    const closeBtn = document.getElementById('close-modal-btn');
    
    modal.classList.add('active');
    spinner.style.display = 'block';
    successIcon.style.display = 'none';
    closeBtn.style.display = 'none';
    statusText.innerText = '訂單傳送中...';
    messageText.innerText = '正在將點餐資訊送到後端';

    try {
        // 1. Send request to backend
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart, total })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            const orderId = data.order_id;
            
            // Render pending state
            statusText.innerText = '點餐成功！請至櫃檯結帳。';
            messageText.innerHTML = `訂單編號: <strong>${orderId}</strong><br><br><small style="color: #ff9e00">等待後端收銀中... 請工作人員在「後端收銀台」點擊「收錢」</small>`;
            
            // 2. Start polling to see if backend cashier has collected money
            const pollInterval = setInterval(async () => {
                try {
                    const checkRes = await fetch(\`http://localhost:5000/api/orders/\${orderId}\`);
                    const checkData = await checkRes.json();
                    
                    if (checkData.status === 'success' && checkData.order.status === 'Paid') {
                        // Payment complete! Stop polling.
                        clearInterval(pollInterval);
                        spinner.style.display = 'none';
                        successIcon.style.display = 'flex';
                        statusText.innerText = '收銀完成！';
                        messageText.innerHTML = \`訂單 <strong>\${orderId}</strong> 已由後端收錢完畢！<br><br><small style="color: #00f5d4">您的飲料正在準備中，稍後發放。</small>\`;
                        closeBtn.style.display = 'inline-block';
                        
                        // Clear the cart
                        cart = [];
                        updateCartUI();
                    }
                } catch (e) {
                    // Ignore transient errors during polling
                }
            }, 2000); // Check every 2 seconds
            
        } else {
            throw new Error(data.message || 'Payment failed');
        }
        
    } catch (error) {
        spinner.style.display = 'none';
        successIcon.style.display = 'flex';
        successIcon.innerHTML = '<i class="ri-error-warning-line"></i>';
        successIcon.style.background = '#e63946';
        successIcon.style.boxShadow = '0 0 20px rgba(230, 57, 70, 0.5)';
        
        statusText.innerText = '連線後端錯誤';
        messageText.innerText = '請確保 Python 後端已經開啟。您需要在後端資料夾執行 \`python app.py\`';
        closeBtn.style.display = 'inline-block';
    }
});

// Close Modal
document.getElementById('close-modal-btn').addEventListener('click', () => {
    document.getElementById('payment-modal').classList.remove('active');
    const successIcon = document.getElementById('payment-success');
    // Reset styling
    successIcon.innerHTML = '<i class="ri-check-line"></i>';
    successIcon.style.background = '#00b4d8';
    successIcon.style.boxShadow = '0 0 20px rgba(0, 180, 216, 0.5)';
});

// Init
renderMenu();
