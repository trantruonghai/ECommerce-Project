const { calculateTotals, MEMBER_DISCOUNT_RATE } = require('../src/services/pricing');

const items = [
  { unit_price: 200000, quantity: 2 }, // 400,000
  { unit_price: 350000, quantity: 1 }, // 350,000
];

describe('member discount (5%)', () => {
  test('rate is 5%', () => {
    expect(MEMBER_DISCOUNT_RATE).toBe(0.05);
  });

  test('guest pays full price, no member discount', () => {
    const r = calculateTotals({ items, isMember: false });
    expect(r.subtotal).toBe(750000);
    expect(r.memberDiscount).toBe(0);
    expect(r.total).toBe(750000);
  });

  test('member gets 5% off the subtotal', () => {
    const r = calculateTotals({ items, isMember: true });
    expect(r.memberDiscount).toBe(37500);
    expect(r.total).toBe(712500);
  });

  test('delivery fee is added after discounts', () => {
    const r = calculateTotals({ items, isMember: true, deliveryFee: 30000 });
    expect(r.total).toBe(742500);
  });

  test('coupon and member discount can be used together', () => {
    const r = calculateTotals({ items, isMember: true, couponDiscount: 50000, deliveryFee: 30000 });
    expect(r.total).toBe(692500);
  });

  test('items marked not eligible are excluded from the member discount', () => {
    const r = calculateTotals({
      items: [
        { unit_price: 100000, quantity: 1 },
        { unit_price: 100000, quantity: 1, member_discount_eligible: false },
      ],
      isMember: true,
    });
    expect(r.subtotal).toBe(200000);
    expect(r.memberDiscount).toBe(5000);
  });

  test('discount is rounded to whole VND', () => {
    const r = calculateTotals({ items: [{ unit_price: 99990, quantity: 1 }], isMember: true });
    expect(Number.isInteger(r.memberDiscount)).toBe(true);
    expect(r.memberDiscount).toBe(5000); // 4999.5 rounds to 5000
  });

  test('total never goes below zero (plus delivery fee)', () => {
    const r = calculateTotals({ items: [{ unit_price: 10000, quantity: 1 }], couponDiscount: 999999, deliveryFee: 30000 });
    expect(r.total).toBe(30000);
  });

  test('numeric strings from PostgreSQL are accepted', () => {
    const r = calculateTotals({ items: [{ unit_price: '200000.00', quantity: 1 }], isMember: true });
    expect(r.memberDiscount).toBe(10000);
  });

  test.each([
    [[], 'Cart is empty'],
    [[{ unit_price: 100000, quantity: 0 }], 'Invalid quantity'],
    [[{ unit_price: 100000, quantity: 1.5 }], 'Invalid quantity'],
    [[{ unit_price: -5, quantity: 1 }], 'Invalid unit price'],
  ])('invalid cart %j throws "%s"', (bad, message) => {
    expect(() => calculateTotals({ items: bad })).toThrow(message);
  });
});
