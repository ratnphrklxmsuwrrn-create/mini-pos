"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function SellPage() {
  // รายการสินค้าทั้งหมดสำหรับ dropdown
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // ตัวเลือกสินค้า + จำนวน ที่กำลังจะเพิ่มลงตะกร้า
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");

  // ตะกร้าสินค้าที่จะขาย (หลายรายการ)
  const [cart, setCart] = useState([]);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [selling, setSelling] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      setErrorMsg("โหลดรายการสินค้าไม่สำเร็จ: " + error.message);
    } else {
      setProducts(data);
    }
    setLoading(false);
  }

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const qtyNumber = parseInt(quantity, 10) || 0;

  // จำนวนที่ถูกใส่ตะกร้าไปแล้วของสินค้าตัวเดียวกัน (กันขายเกิน stock)
  const alreadyInCart = cart
    .filter((item) => item.productId === selectedProductId)
    .reduce((sum, item) => sum + item.quantity, 0);

  const remainingStock = selectedProduct
    ? selectedProduct.stock - alreadyInCart
    : 0;

  function clearMessages() {
    setErrorMsg("");
    setSuccessMsg("");
  }

  // เพิ่มสินค้าที่เลือกลงตะกร้า
  function handleAddToCart(e) {
    e.preventDefault();
    clearMessages();

    if (!selectedProduct) {
      setErrorMsg("กรุณาเลือกสินค้าก่อน");
      return;
    }
    if (!qtyNumber || qtyNumber <= 0) {
      setErrorMsg("กรุณากรอกจำนวนให้ถูกต้อง");
      return;
    }
    if (qtyNumber > remainingStock) {
      setErrorMsg(
        `สินค้าคงเหลือไม่พอ (คงเหลือ ${remainingStock} ${selectedProduct.unit})`
      );
      return;
    }

    // ถ้าสินค้านี้อยู่ในตะกร้าแล้ว ให้รวมจำนวนเข้าด้วยกัน
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (item) => item.productId === selectedProduct.id
      );
      if (existingIndex >= 0) {
        const updated = [...prevCart];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + qtyNumber,
        };
        return updated;
      }
      return [
        ...prevCart,
        {
          productId: selectedProduct.id,
          name: selectedProduct.name,
          price: Number(selectedProduct.price),
          unit: selectedProduct.unit,
          quantity: qtyNumber,
        },
      ];
    });

    setSelectedProductId("");
    setQuantity("");
  }

  // ลบสินค้าออกจากตะกร้า
  function handleRemoveFromCart(productId) {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
    clearMessages();
  }

  // แก้ไขจำนวนของสินค้าที่อยู่ในตะกร้าโดยตรง
  function handleCartQuantityChange(productId, newQty) {
    const qty = parseInt(newQty, 10) || 0;
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.productId === productId ? { ...item, quantity: qty } : item
      )
    );
    clearMessages();
  }

  // ยอดรวมทั้งบิล
  const cartTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // กดยืนยันขายทั้งบิล
  async function handleCheckout() {
    clearMessages();

    if (cart.length === 0) {
      setErrorMsg("ยังไม่มีสินค้าในตะกร้า");
      return;
    }

    // ตรวจสอบจำนวนที่ถูกต้อง + stock เพียงพอ ก่อนบันทึกจริง
    for (const item of cart) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        setErrorMsg(`ไม่พบสินค้า: ${item.name}`);
        return;
      }
      if (item.quantity <= 0) {
        setErrorMsg(`จำนวนของ ${item.name} ต้องมากกว่า 0`);
        return;
      }
      if (item.quantity > product.stock) {
        setErrorMsg(
          `${item.name} คงเหลือไม่พอ (คงเหลือ ${product.stock} ${product.unit})`
        );
        return;
      }
    }

    setSelling(true);
    const soldAt = new Date().toISOString();

    // 1) บันทึกทุกรายการในตะกร้าลงตาราง sales ทีเดียว (bulk insert)
    const salesRows = cart.map((item) => ({
      product_id: item.productId,
      product_name: item.name,
      quantity: item.quantity,
      total_price: item.price * item.quantity,
      sold_at: soldAt,
    }));

    const { error: saleError } = await supabase.from("sales").insert(salesRows);

    if (saleError) {
      setErrorMsg("บันทึกการขายไม่สำเร็จ: " + saleError.message);
      setSelling(false);
      return;
    }

    // 2) อัปเดต stock ของสินค้าแต่ละตัวในตะกร้า + ยิงแจ้งเตือน Telegram
    const now = new Date().toLocaleString("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    for (const item of cart) {
      const product = products.find((p) => p.id === item.productId);
      const newStock = product.stock - item.quantity;
      const itemTotal = item.price * item.quantity;

      const { error: stockError } = await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("id", item.productId);

      if (stockError) {
        setErrorMsg(
          `บันทึกการขายสำเร็จ แต่ปรับสต็อก ${item.name} ไม่สำเร็จ: ` +
            stockError.message
        );
        setSelling(false);
        fetchProducts();
        return;
      }

      // งานที่ 1: แจ้งเตือน Order เข้าใหม่ (ไม่ await ให้บล็อก flow หลัก เพื่อไม่ให้ขายช้า)
      const orderMessage =
        `🛍️ <b>มีรายการขายใหม่!</b>\n` +
        `- สินค้า: ${item.name}\n` +
        `- จำนวน: ${item.quantity} ${item.unit}\n` +
        `- ราคารวม: ${itemTotal.toFixed(2)} บาท\n` +
        `- สต๊อกคงเหลือปัจจุบัน: ${newStock} ${item.unit}\n` +
        `- เวลา: ${now}`;

      sendTelegramNotification(orderMessage);

      // งานที่ 2: แจ้งเตือน Low Stock ถ้าคงเหลือ <= เกณฑ์ที่กำหนด
      if (newStock <= LOW_STOCK_THRESHOLD) {
        const lowStockMessage =
          `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>\n` +
          `- สินค้า: ${item.name}\n` +
          `- คงเหลือเพียง: ${newStock} ${item.unit}\n` +
          `⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`;

        sendTelegramNotification(lowStockMessage);
      }
    }

    // สำเร็จ: แจ้งเตือน, ล้างตะกร้า, โหลดสินค้าใหม่
    setSuccessMsg(
      `ขายสำเร็จ ${totalItemsCount} ชิ้น รวม ${cartTotal.toFixed(2)} บาท`
    );
    setCart([]);
    setSelling(false);
    fetchProducts();
  }

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {/* สรุปยอดรวมตัวใหญ่ ไว้บนสุด ให้ผู้ขายและลูกค้าเห็นชัดจากจอเดียวกัน */}
      <div
        className="card"
        style={{
          textAlign: "center",
          position: "sticky",
          top: 0,
          zIndex: 1,
        }}
      >
        <div style={{ fontSize: "1rem", color: "#6b7280" }}>ยอดรวมทั้งหมด</div>
        <div style={{ fontSize: "3rem", fontWeight: 800, color: "#2563eb" }}>
          {cartTotal.toFixed(2)} บาท
        </div>
        <div style={{ color: "#6b7280" }}>{totalItemsCount} ชิ้น ในตะกร้า</div>
      </div>

      {errorMsg && <p className="error">{errorMsg}</p>}
      {successMsg && <p style={{ color: "#16a34a" }}>{successMsg}</p>}

      {/* ฟอร์มเพิ่มสินค้าลงตะกร้า */}
      <div className="card">
        <h2>เลือกสินค้า</h2>
        {loading ? (
          <p>กำลังโหลดรายการสินค้า...</p>
        ) : (
          <form onSubmit={handleAddToCart}>
            <div className="form-row">
              <select
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  clearMessages();
                }}
                style={{ flex: "2 1 240px" }}
              >
                <option value="">-- เลือกสินค้า --</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({Number(product.price).toFixed(2)} บาท) -
                    คงเหลือ {product.stock} {product.unit}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="1"
                placeholder="จำนวน"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  clearMessages();
                }}
                style={{ flex: "1 1 100px" }}
              />

              <button type="submit" style={{ flex: "0 0 auto" }}>
                + เพิ่มลงตะกร้า
              </button>
            </div>

            {selectedProduct && (
              <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                คงเหลือหลังหักตะกร้า: {remainingStock} {selectedProduct.unit}
              </p>
            )}
          </form>
        )}
      </div>

      {/* ตะกร้าสินค้า */}
      <div className="card">
        <h2>ตะกร้าสินค้า ({cart.length} รายการ)</h2>

        {cart.length === 0 ? (
          <p>ยังไม่มีสินค้าในตะกร้า</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ชื่อสินค้า</th>
                <th>ราคา/หน่วย</th>
                <th>จำนวน</th>
                <th>ยอดรวม</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item) => (
                <tr key={item.productId}>
                  <td>{item.name}</td>
                  <td>{item.price.toFixed(2)}</td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        handleCartQuantityChange(item.productId, e.target.value)
                      }
                      style={{ width: "70px" }}
                    />{" "}
                    {item.unit}
                  </td>
                  <td>{(item.price * item.quantity).toFixed(2)}</td>
                  <td>
                    <button onClick={() => handleRemoveFromCart(item.productId)}>
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: "16px", textAlign: "right" }}>
          <button
            onClick={handleCheckout}
            disabled={selling || cart.length === 0}
            style={{ fontSize: "1.1rem", padding: "12px 24px" }}
          >
            {selling ? "กำลังบันทึก..." : "ยืนยันการขายทั้งหมด"}
          </button>
        </div>
      </div>
    </div>
  );
}
// ฟังก์ชันส่งข้อความแจ้งเตือนผ่าน API Route ของเราเอง (ไม่ยิงตรงไปที่ Telegram จาก client)
// ทำงานแบบ async/try-catch แยกจาก flow หลัก หากพังจะไม่กระทบการขาย
async function sendTelegramNotification(message) {
  try {
    await fetch("/api/notify-telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  } catch (err) {
    // แค่ log ไว้เฉยๆ ไม่ throw ต่อ เพื่อไม่ให้กระทบระบบขาย
    console.error("ส่ง Telegram notification ไม่สำเร็จ:", err);
  }
}

const LOW_STOCK_THRESHOLD = 5;
