import { describe, it, expect, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { Order, DesignRevision, DesignApprovalAuditLog, Notification } from '../../retailer/models/index.js';
import { createRevision, getRevisions, getLatestRevision } from '../../retailer/controllers/orders/revisionController.js';
import { registerRetailerModels } from '../setup.js';

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

describe('Design Revision Controller', () => {
  it('creates a new revision and returns revision data', async () => {
    const orderId = await createTestOrder();
    const designId = 'http://example.com/cad-v1.3dm';
    const req = makeUserReq(
      { id: 'sales_1', email: 'sales@aurajewel.com', role: 'SALES_STAFF' },
      orderId,
      designId,
      { notes: 'Please change the shank width', changeSummary: 'Reduce shank width', images: [{ url: 'http://example.com/revision1.png' }], status: 'SUBMITTED' }
    );
    const res = createMockResponse();

    await createRevision(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.revisionNumber).toBe(1);
    expect(res.body.data.status).toBe('SUBMITTED');
    expect(res.body.data.orderId).toBe(orderId);
    expect(res.body.data.designId).toBe(designId);

    const revision = await DesignRevision.findOne({ orderId, designId, revisionNumber: 1 });
    expect(revision).not.toBeNull();
    expect(revision.notes).toBe('Please change the shank width');

    const audit = await DesignApprovalAuditLog.findOne({ orderId, designId, action: 'REVISION_SUBMIT' });
    expect(audit).not.toBeNull();

    const notif = await Notification.findOne({ type: 'REVISION_SUBMITTED' });
    expect(notif).not.toBeNull();
    expect(notif.relatedEntityId).toBe(orderId);
  });

  it('increments revision number for successive revisions on same design', async () => {
    const orderId = await createTestOrder();
    const designId = 'http://example.com/cad-v1.3dm';

    await createRevision(
      makeUserReq(
        { id: 'sales_1', email: 'sales@aurajewel.com', role: 'SALES_STAFF' },
        orderId,
        designId,
        { notes: 'First revision', status: 'SUBMITTED' }
      ),
      createMockResponse()
    );

    const secondRes = createMockResponse();
    await createRevision(
      makeUserReq(
        { id: 'sales_1', email: 'sales@aurajewel.com', role: 'SALES_STAFF' },
        orderId,
        designId,
        { notes: 'Second revision', status: 'SUBMITTED' }
      ),
      secondRes
    );

    expect(secondRes.body.success).toBe(true);
    expect(secondRes.body.data.revisionNumber).toBe(2);
  });

  it('denies unauthorized roles from creating revisions', async () => {
    const orderId = await createTestOrder();
    const designId = 'http://example.com/cad-v1.3dm';
    const req = makeUserReq(
      { id: 'guest_1', email: 'guest@example.com', role: 'GUEST' },
      orderId,
      designId,
      { notes: 'Unauthorized attempt' }
    );
    const res = createMockResponse();

    await createRevision(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('Unauthorized');
  });

  it('returns revision list for order and design', async () => {
    const orderId = await createTestOrder();
    const designId = 'http://example.com/cad-v1.3dm';

    await createRevision(
      makeUserReq(
        { id: 'sales_1', email: 'sales@aurajewel.com', role: 'SALES_STAFF' },
        orderId,
        designId,
        { notes: 'Initial revision', status: 'SUBMITTED' }
      ),
      createMockResponse()
    );

    const req = makeUserReq(
      { id: 'sales_1', email: 'sales@aurajewel.com', role: 'RETAILER' },
      orderId,
      designId,
      {}
    );
    const res = createMockResponse();
    await getRevisions(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].notes).toBe('Initial revision');
  });

  it('returns the latest revision', async () => {
    const orderId = await createTestOrder();
    const designId = 'http://example.com/cad-v1.3dm';

    await createRevision(
      makeUserReq(
        { id: 'sales_1', email: 'sales@aurajewel.com', role: 'SALES_STAFF' },
        orderId,
        designId,
        { notes: 'First revision', status: 'SUBMITTED' }
      ),
      createMockResponse()
    );

    await createRevision(
      makeUserReq(
        { id: 'sales_1', email: 'sales@aurajewel.com', role: 'SALES_STAFF' },
        orderId,
        designId,
        { notes: 'Second revision', status: 'SUBMITTED' }
      ),
      createMockResponse()
    );

    const req = makeUserReq(
      { id: 'sales_1', email: 'sales@aurajewel.com', role: 'RETAILER' },
      orderId,
      designId,
      {}
    );
    const res = createMockResponse();
    await getLatestRevision(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.revisionNumber).toBe(2);
    expect(res.body.data.notes).toBe('Second revision');
  });

  it('prevents customers from viewing revisions for other orders', async () => {
    const orderId = await createTestOrder();
    const designId = 'http://example.com/cad-v1.3dm';

    await createRevision(
      makeUserReq(
        { id: 'sales_1', email: 'sales@aurajewel.com', role: 'SALES_STAFF' },
        orderId,
        designId,
        { notes: 'Private revision', status: 'SUBMITTED' }
      ),
      createMockResponse()
    );

    const req = makeUserReq(
      { id: 'other_customer', email: 'other@example.com', role: 'CUSTOMER' },
      orderId,
      designId,
      {}
    );
    const res = createMockResponse();
    await getRevisions(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('Access denied');
  });
});
