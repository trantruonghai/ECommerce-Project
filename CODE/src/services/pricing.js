// Pricing rules from the Checkpoint 02 plan:
//  - Guests pay the normal price.
//  - Registered members get 5% off the eligible product subtotal, calculated automatically.
// All money values are whole VND (integers).

const MEMBER_DISCOUNT_RATE = 0.05;

function validateItem(item) {
  const price = Number(item.unit_price);
  const qty = Number(item.quantity);
  if (!Number.isFinite(price) || price < 0) throw new Error('Invalid unit price');
  if (!Number.isInteger(qty) || qty <= 0) throw new Error('Invalid quantity');
  return { price, qty };
}

/**
 * calculateTotals({ items, isMember, couponDiscount, deliveryFee })
 *  items: [{ unit_price, quantity, member_discount_eligible? }]
 *  isMember: true when the request has a valid logged-in customer
 *  couponDiscount: amount (VND) already calculated by the coupon rule, default 0
 *  deliveryFee: fixed fee (VND), default 0
 */
function calculateTotals({ items, isMember = false, couponDiscount = 0, deliveryFee = 0 }) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('Cart is empty');

  let subtotal = 0;
  let eligibleSubtotal = 0;
  for (const item of items) {
    const { price, qty } = validateItem(item);
    const line = price * qty;
    subtotal += line;
    if (item.member_discount_eligible !== false) eligibleSubtotal += line;
  }

  const memberDiscount = isMember ? Math.round(eligibleSubtotal * MEMBER_DISCOUNT_RATE) : 0;
  const coupon = Math.max(0, Number(couponDiscount) || 0);
  const fee = Math.max(0, Number(deliveryFee) || 0);
  const total = Math.max(0, subtotal - memberDiscount - coupon) + fee;

  return {
    subtotal,
    memberDiscount,
    couponDiscount: coupon,
    deliveryFee: fee,
    total,
  };
}

module.exports = { MEMBER_DISCOUNT_RATE, calculateTotals };
