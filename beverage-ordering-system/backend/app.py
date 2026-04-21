from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
import time
import random

app = Flask(__name__)
# 允許跨域請求，讓前端可以與後端溝通
CORS(app)

orders = []

HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>後端收銀台 (Cashier)</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #10002b; color: white; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; background: rgba(255,255,255,0.05); padding: 30px; border-radius: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); }
        h1 { color: #e0aaff; border-bottom: 2px solid #9d4edd; padding-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
        .order { background: rgba(0,0,0,0.3); border: 1px solid #333; padding: 20px; margin-bottom: 20px; border-radius: 12px; transition: 0.3s; }
        .order:hover { border-color: #9d4edd; box-shadow: 0 0 15px rgba(157, 78, 221, 0.3); }
        .Pending { border-left: 5px solid #ff9e00; }
        .Paid { border-left: 5px solid #00f5d4; }
        .items { margin: 15px 0; color: #c8b6ff; font-size: 16px; line-height: 1.6; }
        .btn { background: #ff9e00; color: #000; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold; transition: 0.2s; }
        .btn:hover { background: #ffb703; transform: translateY(-2px); }
        .btn:disabled { background: #333; color: #666; cursor: not-allowed; transform: none; }
        .status-badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 14px; font-weight: bold; margin-left: 10px; }
        .status-Pending { background: rgba(255, 158, 0, 0.2); color: #ff9e00; }
        .status-Paid { background: rgba(0, 245, 212, 0.2); color: #00f5d4; }
        .header-btn { background: #9d4edd; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 14px; }
        .header-btn:hover { background: #7b2cbf; }
    </style>
</head>
<body>
    <div class="container">
        <h1>
            🛒 後端專用介面：收銀台 
            <button class="header-btn" onclick="location.reload()">重新整理訂單</button>
        </h1>
        <p style="color: #c8b6ff; margin-bottom: 25px;">這裡是後端收費系統的專屬介面，您可以在這裡查看前端送來的點餐，並點擊按鈕來向客戶「收錢」。</p>
        
        <div id="orders">
            {% for order in orders|reverse %}
            <div class="order {{ order.status }}">
                <h3 style="margin: 0; font-size: 20px;">訂單編號: {{ order.order_id }} <span class="status-badge status-{{ order.status }}">{{ order.status }}</span></h3>
                <div class="items">
                    {% for item in order.items %}
                    <div>• {{ item.name }} x {{ item.quantity }} &nbsp; <span style="color: #fff;">(${{ item.price * item.quantity }})</span></div>
                    {% endfor %}
                </div>
                <h3 style="margin: 0 0 15px 0; color: #00f5d4;">應收總額: ${{ order.total }}</h3>
                
                {% if order.status == 'Pending' %}
                <button class="btn" onclick="payOrder('{{ order.order_id }}')">💰 收錢 / 確認結帳</button>
                {% else %}
                <button class="btn" disabled>✅ 已收銀完成</button>
                {% endif %}
            </div>
            {% endfor %}
            
            {% if not orders %}
            <div style="text-align: center; padding: 40px; color: #666; border: 1px dashed #444; border-radius: 10px;">
                目前尚未有前端送來的訂單，請先至前端介面點餐。
            </div>
            {% endif %}
        </div>
    </div>

    <script>
        async function payOrder(orderId) {
            try {
                const res = await fetch('/api/orders/' + orderId + '/pay', { method: 'POST' });
                if (res.ok) {
                    location.reload();
                } else {
                    alert('收銀發生錯誤！');
                }
            } catch (e) {
                alert('網路連線錯誤');
            }
        }
        
        // Auto refresh every 3 seconds to check for new front-end orders
        setInterval(() => window.location.reload(), 3000); 
    </script>
</body>
</html>
"""

@app.route('/api/ping', methods=['GET'])
def ping():
    return jsonify({"status": "ok", "message": "Backend is running!"})

@app.route('/cashier', methods=['GET'])
def cashier():
    return render_template_string(HTML_TEMPLATE, orders=orders)

@app.route('/api/checkout', methods=['POST'])
def checkout():
    data = request.json
    cart = data.get('cart', [])
    total = data.get('total', 0)
    
    if not cart:
        return jsonify({'status': 'error', 'message': '購物車是空的'}), 400
        
    print("\n" + "="*30)
    print("[NEW ORDER] 收到前端點餐請求！(等待收銀與付款確認)")
    
    order_id = f"ORD{random.randint(10000, 99999)}"
    
    order = {
        'order_id': order_id,
        'items': cart,
        'total': total,
        'status': 'Pending' # 待收銀
    }
    orders.append(order)
    
    print(f"訂單號碼: {order_id}，總金額: ${total}")
    print("="*30 + "\n")
    
    return jsonify({
        'status': 'success',
        'message': f'訂單已送出，請等待櫃檯收銀。',
        'order_id': order_id,
        'order': order
    })

@app.route('/api/orders/<order_id>', methods=['GET'])
def get_order(order_id):
    for order in orders:
        if order['order_id'] == order_id:
            return jsonify({'status': 'success', 'order': order})
    return jsonify({'status': 'error', 'message': 'Order not found'}), 404

@app.route('/api/orders/<order_id>/pay', methods=['POST'])
def pay_order(order_id):
    for order in orders:
        if order['order_id'] == order_id:
            order['status'] = 'Paid'
            print("\n" + "="*30)
            print(f"[PAID] 後端已完成收錢！訂單號碼: {order_id}")
            print("="*30 + "\n")
            return jsonify({'status': 'success', 'order': order})
    return jsonify({'status': 'error', 'message': 'Order not found'}), 404

if __name__ == '__main__':
    print("\n[START] Boba Store 後端伺服器啟動中...")
    print("=======================================")
    print("【前端點餐機】：請使用瀏覽器開啟 frontend/index.html")
    print("【後端收銀台】：請在瀏覽器開啟 http://localhost:5000/cashier")
    print("=======================================\n")
    app.run(debug=True, port=5000, host="0.0.0.0")
