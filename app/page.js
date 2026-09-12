"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ProductsPage() {
  // รายการสินค้าทั้งหมด
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // ฟอร์มเพิ่มสินค้าใหม่
  const [form, setForm] = useState({
    sku: "",
    name: "",
    price: "",
    stock: "",
    unit: "",
  });
  const [saving, setSaving] = useState(false);

  // แถวที่กำลังแก้ไข (inline edit)
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // โหลดข้อมูลสินค้าครั้งแรกที่เข้าหน้า
  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg("โหลดข้อมูลสินค้าไม่สำเร็จ: " + error.message);
    } else {
      setProducts(data);
      setErrorMsg("");
    }
    setLoading(false);
  }

  // จัดการค่าที่พิมพ์ในฟอร์มเพิ่มสินค้า
  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // บันทึกสินค้าใหม่ลงตาราง products
  async function handleAddProduct(e) {
    e.preventDefault();
    if (!form.sku || !form.name || !form.price) {
      setErrorMsg("กรุณากรอก SKU, ชื่อสินค้า และราคาให้ครบ");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("products").insert([
      {
        sku: form.sku,
        name: form.name,
        price: parseFloat(form.price),
        stock: form.stock ? parseInt(form.stock, 10) : 0,
        unit: form.unit,
      },
    ]);

    if (error) {
      setErrorMsg("เพิ่มสินค้าไม่สำเร็จ: " + error.message);
    } else {
      setForm({ sku: "", name: "", price: "", stock: "", unit: "" });
      setErrorMsg("");
      fetchProducts();
    }
    setSaving(false);
  }

  // ลบสินค้า
  async function handleDelete(id) {
    const confirmDelete = confirm("ยืนยันการลบสินค้านี้หรือไม่?");
    if (!confirmDelete) return;

    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      setErrorMsg("ลบสินค้าไม่สำเร็จ: " + error.message);
    } else {
      fetchProducts();
    }
  }

  // เริ่มแก้ไขแถว (inline edit)
  function startEdit(product) {
    setEditingId(product.id);
    setEditForm({
      sku: product.sku,
      name: product.name,
      price: product.price,
      stock: product.stock,
      unit: product.unit,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
  }

  function handleEditChange(e) {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  }

  // บันทึกการแก้ไขสินค้า
  async function handleUpdateProduct(id) {
    const { error } = await supabase
      .from("products")
      .update({
        sku: editForm.sku,
        name: editForm.name,
        price: parseFloat(editForm.price),
        stock: parseInt(editForm.stock, 10),
        unit: editForm.unit,
      })
      .eq("id", id);

    if (error) {
      setErrorMsg("แก้ไขสินค้าไม่สำเร็จ: " + error.message);
    } else {
      setEditingId(null);
      setEditForm({});
      fetchProducts();
    }
  }

  return (
    <div>
      <h1>รายการสินค้า</h1>

      {errorMsg && <p className="error">{errorMsg}</p>}

      {/* ฟอร์มเพิ่มสินค้าใหม่ */}
      <div className="card">
        <h2>เพิ่มสินค้าใหม่</h2>
        <form onSubmit={handleAddProduct}>
          <div className="form-row">
            <input
              type="text"
              name="sku"
              placeholder="SKU"
              value={form.sku}
              onChange={handleFormChange}
            />
            <input
              type="text"
              name="name"
              placeholder="ชื่อสินค้า"
              value={form.name}
              onChange={handleFormChange}
            />
            <input
              type="number"
              name="price"
              placeholder="ราคา"
              step="0.01"
              value={form.price}
              onChange={handleFormChange}
            />
            <input
              type="number"
              name="stock"
              placeholder="จำนวนคงเหลือ"
              value={form.stock}
              onChange={handleFormChange}
            />
            <input
              type="text"
              name="unit"
              placeholder="หน่วย (เช่น ชิ้น, ขวด)"
              value={form.unit}
              onChange={handleFormChange}
            />
            <button type="submit" disabled={saving}>
              {saving ? "กำลังบันทึก..." : "เพิ่มสินค้า"}
            </button>
          </div>
        </form>
      </div>

      {/* ตารางแสดงรายการสินค้า */}
      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>ชื่อสินค้า</th>
              <th>ราคา</th>
              <th>คงเหลือ</th>
              <th>หน่วย</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan="6">ยังไม่มีสินค้าในระบบ</td>
              </tr>
            )}

            {products.map((product) => (
              <tr key={product.id}>
                {editingId === product.id ? (
                  // โหมดแก้ไข inline
                  <>
                    <td>
                      <input
                        type="text"
                        name="sku"
                        value={editForm.sku}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        name="name"
                        value={editForm.name}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        name="price"
                        step="0.01"
                        value={editForm.price}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        name="stock"
                        value={editForm.stock}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        name="unit"
                        value={editForm.unit}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td>
                      <button onClick={() => handleUpdateProduct(product.id)}>
                        บันทึก
                      </button>{" "}
                      <button onClick={cancelEdit}>ยกเลิก</button>
                    </td>
                  </>
                ) : (
                  // โหมดแสดงผลปกติ
                  <>
                    <td>{product.sku}</td>
                    <td>{product.name}</td>
                    <td>{Number(product.price).toFixed(2)}</td>
                    <td>{product.stock}</td>
                    <td>{product.unit}</td>
                    <td>
                      <button onClick={() => startEdit(product)}>แก้ไข</button>{" "}
                      <button onClick={() => handleDelete(product.id)}>
                        ลบ
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
