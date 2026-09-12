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
  function handleCartQuantityChange(productId, newQty)
