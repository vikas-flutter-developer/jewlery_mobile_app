import { describe, it, expect } from '@jest/globals';
import { Order, OrderTracking, Notification } from '../../retailer/models/index.js';
import { generateTracking, getOrderTrackingInternal, updateTrackingStatus, getPublicOrderTracking, revokeTracking } from '../../retailer/controllers/orders/orderTrackingController.js';

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

async function createTestOrder() {
  return await Order.create({
    customerName: 'Tracking Client',
    customerContact: '8888888888',
    customerEmail: 'tracking@example.com',
    status: 'PENDING',
    specifications: '24K Gold Bracelet'
  });
}

describe('Order Tracking System Controller Tests', () => {
  it('generates tracking link and creates active tracking record with notifications', async () => {
    const order = await createTestOrder();
    const req: any = {
      params: { orderId: order._id.toString() },
      body: { expiresDays: 10 },
      user: { id: 'admin_123', email: 'admin@aurajewel.com', role: 'ADMIN' }
    };
    const res = createMockResponse();

    await generateTracking(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.trackingStatus).toBe('ORDER_PLACED');
    expect(res.body.data.isActive).toBe(true);

    const tracking = await OrderTracking.findOne({ orderId: order._id });
    expect(tracking).not.toBeNull();
    expect(tracking.trackingCode).toMatch(/^TRK/);

    const notif = await Notification.findOne({ type: 'TRACKING_LINK_GENERATED' });
    expect(notif).not.toBeNull();
  });

  it('queries internal active tracking state', async () => {
    const order = await createTestOrder();
    // Pre-create tracking record
    await OrderTracking.create({
      orderId: order._id,
      trackingCode: 'TRKTEST111',
      publicToken: 'token-uuid-111',
      shareableUrl: '/track/token-uuid-111',
      trackingStatus: 'ORDER_PLACED',
      expiresAt: new Date(Date.now() + 86400000),
      isActive: true
    });

    const req: any = {
      params: { orderId: order._id.toString() }
    };
    const res = createMockResponse();

    await getOrderTrackingInternal(req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.trackingCode).toBe('TRKTEST111');
  });

  it('updates tracking status and triggers events', async () => {
    const order = await createTestOrder();
    await OrderTracking.create({
      orderId: order._id,
      trackingCode: 'TRKTEST222',
      publicToken: 'token-uuid-222',
      shareableUrl: '/track/token-uuid-222',
      trackingStatus: 'ORDER_PLACED',
      expiresAt: new Date(Date.now() + 86400000),
      isActive: true
    });

    const req: any = {
      params: { orderId: order._id.toString() },
      body: { status: 'IN_PRODUCTION' },
      user: { id: 'admin_123', email: 'admin@aurajewel.com', role: 'ADMIN' }
    };
    const res = createMockResponse();

    await updateTrackingStatus(req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.trackingStatus).toBe('IN_PRODUCTION');

    const updatedTracking = await OrderTracking.findOne({ trackingCode: 'TRKTEST222' });
    expect(updatedTracking.statusTimeline.length).toBe(1);
    expect(updatedTracking.statusTimeline[0].status).toBe('IN_PRODUCTION');

    const notif = await Notification.findOne({ type: 'TRACKING_STATUS_UPDATED' });
    expect(notif).not.toBeNull();
  });

  it('exposes public tracking data sanitized (no financial costs or employee information)', async () => {
    const order = await createTestOrder();
    // Add billing summary details (simulating sensitive internal pricing)
    order.billingSummary = {
      labourCharges: 500,
      metalLossCost: 100,
      profitAmount: 2000
    };
    await order.save();

    await OrderTracking.create({
      orderId: order._id,
      trackingCode: 'TRKTEST333',
      publicToken: 'token-uuid-333',
      shareableUrl: '/track/token-uuid-333',
      trackingStatus: 'QUALITY_CHECK',
      expiresAt: new Date(Date.now() + 86400000),
      isActive: true
    });

    const req: any = {
      params: { token: 'token-uuid-333' }
    };
    const res = createMockResponse();

    await getPublicOrderTracking(req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('QUALITY_CHECK');
    expect(res.body.data.progressPercentage).toBeGreaterThan(0);
    // Secure verification check: Ensure internal profit margins/charges are not returned
    expect(res.body.data.labourCharges).toBeUndefined();
    expect(res.body.data.profitAmount).toBeUndefined();
  });

  it('revokes tracking link manual action', async () => {
    const order = await createTestOrder();
    await OrderTracking.create({
      orderId: order._id,
      trackingCode: 'TRKTEST444',
      publicToken: 'token-uuid-444',
      shareableUrl: '/track/token-uuid-444',
      trackingStatus: 'ORDER_PLACED',
      expiresAt: new Date(Date.now() + 86400000),
      isActive: true
    });

    const req: any = {
      params: { orderId: order._id.toString() },
      user: { id: 'admin_123', email: 'admin@aurajewel.com', role: 'ADMIN' }
    };
    const res = createMockResponse();

    await revokeTracking(req, res);

    expect(res.body.success).toBe(true);

    const revokedTracking = await OrderTracking.findOne({ trackingCode: 'TRKTEST444' });
    expect(revokedTracking.isActive).toBe(false);
  });
});
