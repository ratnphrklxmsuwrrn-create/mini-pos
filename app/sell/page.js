"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function SellPage() {
  // รายการสินค้าทั้งหมดสำหรับ dropdown
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // สินค้าที่เลือกและจำนวนที่จะขาย
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [selling, setSelling] = useState(false);

  // โหลดรายการสินค้าเมื่อเข้าหน้า
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

  // หาสินค้าที่ถูกเลือกอยู่ตอนนี้ (ใช้คำนวณยอดรวม)
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // คำนวณยอดรวม = ราคา x จำนวน
  const qtyNumber = parseInt(quantity, 10) || 0;
  const totalPrice = selectedProduct
    ? Number(selectedProduct.price) * qtyNumber
    : 0;

  // ล้างข้อความแจ้งเตือนก่อนแก้ไขค่าในฟอร์ม
  function handleProductChange(e) {
    setSelectedProductId(e.target.value);
    setErrorMsg("");
    setSuccessMsg("");
  }

  function handleQuantityChange(e) {
    setQuantity(e.target.value);
    setErrorMsg("");
    setSuccessMsg("");
  }

  // กดปุ่ม "ขาย"
  async function handleSell(e) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!selectedProduct) {
      setErrorMsg("กรุณาเลือกสินค้าก่อน");
      return;
    }
    if (!qtyNumber || qtyNumber <= 0) {
      setErrorMsg("กรุณากรอกจำนวนที่จะขายให้ถูกต้อง");
      return;
    }

    // ตรวจสอบ stock คงเหลือให้เพียงพอ
    if (qtyNumber > selectedProduct.stock) {
      setErrorMsg(
        `สินค้าคงเหลือไม่พอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit})`
      );
      return;
    }

    setSelling(true);

    // 1) บันทึกรายการขายลงตาราง sales
    const { error: saleError } = await supabase.from("sales").insert([
      {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: qtyNumber,
        total_price: totalPrice,
        sold_at: new Date().toISOString(),
      },
    ]);

    if (saleError) {
      setErrorMsg("บันทึกการขายไม่สำเร็จ: " + saleError.message);
      setSelling(false);
      return;
    }

    // 2) อัปเดต stock ของสินค้าให้ลดลง
    const newStock = selectedProduct.stock - qtyNumber;
    const { error: stockError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", selectedProduct.id);

    if (stockError) {
      setErrorMsg(
        "บันทึกการขายสำเร็จ แต่ปรับปรุงสต็อกไม่สำเร็จ: " + stockError.message
      );
      setSelling(false);
      return;
    }

    // สำเร็จ: แจ้งเตือนและรีเซ็ตฟอร์ม
    setSuccessMsg(
      `ขาย ${selectedProduct.name} จำนวน ${qtyNumber} ${selectedProduct.unit} สำเร็จ (ยอดรวม ${totalPrice.toFixed(
        2
      )} บาท)`
    );
    setSelectedProductId("");
    setQuantity("");
    setSelling(false);

    // โหลดรายการสินค้าใหม่เพื่ออัปเดต stock ที่แสดงใน dropdown
    fetchProducts();
  }

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {errorMsg && <p className="error">{errorMsg}</p>}
      {successMsg && <p style={{ color: "#16a34a" }}>{successMsg}</p>}

      <div className="card">
        {loading ? (
          <p>กำลังโหลดรายการสินค้า...</p>
        ) : (
          <form onSubmit={handleSell}>
            <div className="form-row">
              {/* Dropdown เลือกสินค้า */}
              <select value={selectedProductId} onChange={handleProductChange}>
                <option value="">-- เลือกสินค้า --</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({Number(product.price).toFixed(2)} บาท) -
                    คงเหลือ {product.stock} {product.unit}
                  </option>
                ))}
              </select>

              {/* จำนวนที่จะขาย */}
              <input
                type="number"
                min="1"
                placeholder="จำนวน"
                value={quantity}
                onChange={handleQuantityChange}
              />

              <button type="submit" disabled={selling}>
                {selling ? "กำลังบันทึก..." : "ขาย"}
              </button>
            </div>

            {/* แสดงยอดรวมอัตโนมัติ */}
            {selectedProduct && qtyNumber > 0 && (
              <p>
                ยอดรวม: <strong>{totalPrice.toFixed(2)} บาท</strong>
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
