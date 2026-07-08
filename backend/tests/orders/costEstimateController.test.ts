import { describe, it, expect } from '@jest/globals';
import { Order, CostEstimate, CostEstimateAuditLog, Notification } from '../../retailer/models/index.js';
import {
  createCostEstimate,
  getCostEstimates,
  getLatestCostEstimate,
  approveCostEstimate,
  declineCostEstimate,
} from '../../retailer/controllers/orders/costEstimateController.js';

function createMockResponse() {
  const res: any = { statusCode: 200 };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    if (!res.statusCode) res.statusCode = 200;
    res.body = data;
    return res;
  };
  return res;
}

async function createTestOrder() {
  const order = await Order.create({
    customerName: 'Test Customer',
    customerContact: '9999999999',
    customerEmail: 'customer@example.com',
    customerId: 'cust_test',
    status: 'DESIGNING',
    designApproval: 'PENDING',
    cadDesigns: [{ url: 'http://example.com/cad-v1.3dm', name: 'Ring V1' }],
  });
  return order._id.toString();
}

function makeUserReq(user: any, orderId: string, designId: string, body: any = {}) {
  return {
    params: { orderId, designId },
    body,
    user,
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {},
  } as any;
}

function makeUserReqWithEstimateId(user: any, orderId: string, designId: string, estimateId: string, body: any = {}) {
  return {
    params: { orderId, designId, estimateId },
    body,
    user,
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {},
  } as any;
}

describe('Cost Estimate Controller', () => {
  it('creates and submits a cost estimate for an order', async () => {
    const orderId = await createTestOrder();
    const designId = 'http://example.com/cad-v1.3dm';
    const req = makeUserReq(
      { id: 'sales_1', email: 'sales@aurajewel.com', role: 'SALES_STAFF' },
      orderId,
      designId,
      { metalCost: 25000, stoneCost: 15000, makingCharges: 5000, gstPercent: 3, notes: 'Standard estimate', status: 'SUBMITTED' }
    );
    const res = createMockResponse();

    await createCostEstimate(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.estimateNumber).toBe(1);
    expect(res.body.data.status).toBe('SUBMITTED');
    expect(res.body.data.total).toBe(46350);

    const order = await Order.findById(orderId);
    expect(order.costEstimate.total).toBe(46350);

    const audit = await CostEstimateAuditLog.findOne({ orderId, designId, action: 'ESTIMATE_SUBMIT' });
    expect(audit).not.toBeNull();

    const notif = await Notification.findOne({ type: 'ESTIMATE_SUBMITTED' });
    expect(notif).not.toBeNull();
    expect(notif.relatedEntityId).toBe(orderId);
  });

  it('retrieves all cost estimates and the latest estimate', async () => {
    const orderId = await createTestOrder();
    const designId = 'http://example.com/cad-v1.3dm';
    const user = { id: 'sales_1', email: 'sales@aurajewel.com', role: 'SALES_STAFF' };

    await createCostEstimate(
      makeUserReq(user, orderId, designId, { metalCost: 10000, stoneCost: 5000, makingCharges: 2500, gstPercent: 3, status: 'SUBMITTED' }),
      createMockResponse()
    );
    await createCostEstimate(
      makeUserReq(user, orderId, designId, { metalCost: 12000, stoneCost: 6000, makingCharges: 3000, gstPercent: 3, status: 'SUBMITTED' }),
      createMockResponse()
    );

    const listRes = createMockResponse();
    await getCostEstimates(makeUserReq({ id: 'retailer_1', email: 'retailer@aurajewel.com', role: 'RETAILER' }, orderId, designId), listRes);

    expect(listRes.statusCode).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.data.length).toBe(2);
    expect(listRes.body.data[0].estimateNumber).toBe(2);

    const latestRes = createMockResponse();
    await getLatestCostEstimate(makeUserReq({ id: 'retailer_1', email: 'retailer@aurajewel.com', role: 'RETAILER' }, orderId, designId), latestRes);

    expect(latestRes.statusCode).toBe(200);
    expect(latestRes.body.data.estimateNumber).toBe(2);
    expect(latestRes.body.data.metalCost).toBe(12000);
  });

  it('approves a submitted cost estimate and updates the order', async () => {
    const orderId = await createTestOrder();
    const designId = 'http://example.com/cad-v1.3dm';
    const createRes = createMockResponse();
    await createCostEstimate(
      makeUserReq(
        { id: 'sales_1', email: 'sales@aurajewel.com', role: 'SALES_STAFF' },
        orderId,
        designId,
        { metalCost: 20000, stoneCost: 10000, makingCharges: 4000, gstPercent: 3, status: 'SUBMITTED' }
      ),
      createRes
    );

    const estimateId = createRes.body.data.estimateId;
    const approveReq = makeUserReqWithEstimateId(
      { id: 'cust_123', email: 'customer@example.com', role: 'CUSTOMER' },
      orderId,
      designId,
      estimateId,
      { notes: 'Approve this estimate' }
    );
    const approveRes = createMockResponse();

    await approveCostEstimate(approveReq, approveRes);

    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.body.success).toBe(true);
    expect(approveRes.body.data.status).toBe('APPROVED');

    const refreshedOrder = await Order.findById(orderId);
    expect(refreshedOrder.costEstimate.total).toBe(35020);
  });

  it('declines a submitted cost estimate when requested by a customer', async () => {
    const orderId = await createTestOrder();
    const designId = 'http://example.com/cad-v1.3dm';
    const createRes = createMockResponse();
    await createCostEstimate(
      makeUserReq(
        { id: 'sales_1', email: 'sales@aurajewel.com', role: 'SALES_STAFF' },
        orderId,
        designId,
        { metalCost: 18000, stoneCost: 9000, makingCharges: 3000, gstPercent: 3, status: 'SUBMITTED' }
      ),
      createRes
    );

    const estimateId = createRes.body.data.estimateId;
    const declineReq = makeUserReqWithEstimateId(
      { id: 'cust_123', email: 'customer@example.com', role: 'CUSTOMER' },
      orderId,
      designId,
      estimateId,
      { notes: 'Decline this estimate' }
    );
    const declineRes = createMockResponse();

    await declineCostEstimate(declineReq, declineRes);

    expect(declineRes.statusCode).toBe(200);
    expect(declineRes.body.success).toBe(true);
    expect(declineRes.body.data.status).toBe('DECLINED');

    const estimate = await CostEstimate.findOne({ estimateId });
    expect(estimate.status).toBe('DECLINED');
    expect(estimate.total).toBe(30900);
  });

  it('prevents unauthorized roles from creating cost estimates', async () => {
    const orderId = await createTestOrder();
    const designId = 'http://example.com/cad-v1.3dm';
    const req = makeUserReq(
      { id: 'guest_1', email: 'guest@example.com', role: 'GUEST' },
      orderId,
      designId,
      { metalCost: 1000, stoneCost: 500, makingCharges: 100 }
    );
    const res = createMockResponse();

    await createCostEstimate(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('Unauthorized');
  });
});
