import { describe, it, expect } from '@jest/globals';
import { Customer, CustomerReferral, Sale, Notification } from '../../retailer/models/index.js';
import { generateReferralCode, registerReferral, getMyReferrals, getMyRewards, getReferralSummary, processReferralReward } from '../../retailer/controllers/referrals/referralsController.js';

function createMockResponse() {
  const res: any = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.body = data;
    return res;
  };
  return res;
}

async function createTestCustomer(name: string, phone: string, email: string) {
  return await Customer.create({
    name,
    phone,
    email,
    customerTier: 'NORMAL',
    referredBy: ''
  });
}

describe('Referral Rewards System Unit Tests', () => {
  it('generates a unique referral code and registers it to customer profile', async () => {
    const cust = await createTestCustomer('Referrer One', '9999000001', 'ref1@example.com');
    const req: any = {
      user: { phone: '9999000001', email: 'ref1@example.com', role: 'CUSTOMER' }
    };
    const res = createMockResponse();

    await generateReferralCode(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.referralCode).toMatch(/^REFE-/);

    const updated = await Customer.findById(cust._id);
    expect(updated.referredBy).toBe(res.body.referralCode);
  });

  it('prevents self-referral registration', async () => {
    const cust = await createTestCustomer('Self Referrer', '9999000002', 'self@example.com');
    // Save a referral code for this customer
    cust.referredBy = 'SELF-1234';
    await cust.save();

    const req: any = {
      body: { referralCode: 'SELF-1234', referredCustomerPhone: '9999000002' },
      user: { role: 'SALES_STAFF', email: 'sales@aurajewel.com' }
    };
    const res = createMockResponse();

    await registerReferral(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Self-referral is strictly prohibited');
  });

  it('registers a valid referral and triggers alerts/notifications', async () => {
    const referrer = await createTestCustomer('Referrer Two', '9999000003', 'ref2@example.com');
    referrer.referredBy = 'REF2-CODE';
    await referrer.save();

    const referred = await createTestCustomer('Referred Customer Two', '9999000004', 'referred2@example.com');

    const req: any = {
      body: { referralCode: 'REF2-CODE', referredCustomerPhone: '9999000004' },
      user: { role: 'SALES_STAFF', email: 'sales@aurajewel.com' }
    };
    const res = createMockResponse();

    await registerReferral(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);

    const referral = await CustomerReferral.findOne({ referredCustomerId: referred._id });
    expect(referral).not.toBeNull();
    expect(referral.referralStatus).toBe('PENDING');

    const notif = await Notification.findOne({ type: 'REFERRAL_REGISTERED' });
    expect(notif).not.toBeNull();
  });

  it('prevents duplicate referral registrations for same referred customer', async () => {
    const referrer = await createTestCustomer('Referrer Three', '9999000005', 'ref3@example.com');
    referrer.referredBy = 'REF3-CODE';
    await referrer.save();

    const referred = await createTestCustomer('Referred Customer Three', '9999000006', 'referred3@example.com');

    // Create preexisting referral
    await CustomerReferral.create({
      referrerCustomerId: referrer._id,
      referredCustomerId: referred._id,
      referralCode: 'REF3-CODE',
      referralStatus: 'PENDING'
    });

    const req: any = {
      body: { referralCode: 'REF3-CODE', referredCustomerPhone: '9999000006' },
      user: { role: 'SALES_STAFF', email: 'sales@aurajewel.com' }
    };
    const res = createMockResponse();

    await registerReferral(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('already been referred');
  });

  it('auto-qualifies referral and awards points when referred customer makes first purchase', async () => {
    const referrer = await createTestCustomer('Referrer Four', '9999000007', 'ref4@example.com');
    referrer.referredBy = 'REF4-CODE';
    referrer.loyaltyPoints = 0;
    await referrer.save();

    const referred = await createTestCustomer('Referred Customer Four', '9999000008', 'referred4@example.com');

    // Setup referral relationship
    await CustomerReferral.create({
      referrerCustomerId: referrer._id,
      referredCustomerId: referred._id,
      referralCode: 'REF4-CODE',
      referralStatus: 'PENDING',
      rewardType: 'POINTS',
      rewardValue: 150
    });

    // Simulate first purchase
    const sale = await Sale.create({
      orderId: 'dummy_order_id_123',
      customerId: referred._id,
      customerName: referred.name,
      customerPhone: referred.phone,
      total: 10000,
      payable: 10000,
      status: 'completed'
    });


    // Auto-trigger
    const { handlePostSaleReferralReward } = await import('../../retailer/controllers/referrals/referralsController.js');
    await handlePostSaleReferralReward(sale);

    const updatedRef = await CustomerReferral.findOne({ referredCustomerId: referred._id });
    expect(updatedRef.referralStatus).toBe('QUALIFIED');
    expect(updatedRef.rewardStatus).toBe('ISSUED');

    const updatedReferrer = await Customer.findById(referrer._id);
    expect(updatedReferrer.loyaltyPoints).toBe(150);

    const notif = await Notification.findOne({ type: 'REFERRAL_REWARD_EARNED' });
    expect(notif).not.toBeNull();
  });
});
