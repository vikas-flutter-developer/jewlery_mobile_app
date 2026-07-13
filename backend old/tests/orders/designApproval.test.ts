import { describe, it, expect, beforeEach } from '@jest/globals';
import { Order, DesignApproval, DesignApprovalAuditLog, Notification } from '../../retailer/models/index.js';
import { submitDesign, approveDesign, rejectDesign, requestChanges } from '../../retailer/controllers/orders/approvalController.js';

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
  const order = await Order.create({
    customerName: 'Ammar Test',
    customerContact: '9876543210',
    customerEmail: 'ammar@example.com',
    customerId: 'cust_123',
    status: 'PENDING',
    designApproval: 'PENDING',
    cadDesigns: [{ url: 'http://example.com/cad1.3dm', name: 'Ring Design V1' }]
  });
  return order._id.toString();
}

function makeSalesReq(orderId: string, designId: string, body: any = {}): any {
  return {
    params: { orderId, designId },
    body,
    user: { id: 'sales_123', email: 'sales@example.com', role: 'SALES_STAFF' },
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {}
  };
}

function makeCustomerReq(orderId: string, designId: string, body: any = {}): any {
  return {
    params: { orderId, designId },
    body,
    user: { id: 'cust_123', email: 'ammar@example.com', role: 'CUSTOMER' },
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {}
  };
}

describe('Design Approval Workflow Controller', () => {
  const designId = 'CAD-TEST-001';

  it('submits a design successfully and creates audit log + notification', async () => {
    const orderId = await createTestOrder();
    const req = makeSalesReq(orderId, designId, { notes: 'Please review design' });
    const res = createMockResponse();

    await submitDesign(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.approvalStatus).toBe('PENDING');
    expect(res.body.data.version).toBe(1);

    const audit = await DesignApprovalAuditLog.findOne({ orderId, designId, action: 'SUBMIT' });
    expect(audit).not.toBeNull();
    expect(audit.userRole).toBe('SALES_STAFF');

    const notif = await Notification.findOne({ type: 'DESIGN_SUBMITTED' });
    expect(notif).not.toBeNull();
    expect(notif.relatedEntityId).toBe(orderId);
  });

  it('returns 400 when approving a design that was never submitted', async () => {
    const orderId = await createTestOrder();
    const req = makeCustomerReq(orderId, 'CAD-DRAFT-999', { notes: 'Approved draft' });
    const res = createMockResponse();

    await approveDesign(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Design must be submitted first');
  });

  it('requests changes and sets approvalStatus to CHANGES_REQUESTED', async () => {
    const orderId = await createTestOrder();

    // First submit the design
    const submitReq = makeSalesReq(orderId, designId, { notes: 'Submitted for review' });
    const submitRes = createMockResponse();
    await submitDesign(submitReq, submitRes);
    expect(submitRes.statusCode).toBe(201);

    // Now request changes
    const req = makeCustomerReq(orderId, designId, { changeRequest: 'Reduce thickness by 1mm' });
    const res = createMockResponse();
    await requestChanges(req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.approvalStatus).toBe('CHANGES_REQUESTED');
    expect(res.body.data.changeRequest).toBe('Reduce thickness by 1mm');

    const audit = await DesignApprovalAuditLog.findOne({ orderId, designId, action: 'REQUEST_CHANGES' });
    expect(audit).not.toBeNull();

    const notif = await Notification.findOne({ type: 'DESIGN_CHANGES_REQUESTED' });
    expect(notif).not.toBeNull();
  });

  it('allows resubmission (version increment) after changes requested', async () => {
    const orderId = await createTestOrder();

    // Submit v1
    const submit1 = makeSalesReq(orderId, designId, { notes: 'Version 1' });
    const submitRes1 = createMockResponse();
    await submitDesign(submit1, submitRes1);
    expect(submitRes1.statusCode).toBe(201);
    expect(submitRes1.body.data.version).toBe(1);

    // Request changes on v1
    const changesReq = makeCustomerReq(orderId, designId, { changeRequest: 'Reduce thickness' });
    const changesRes = createMockResponse();
    await requestChanges(changesReq, changesRes);
    expect(changesRes.body.success).toBe(true);

    // Submit v2
    const submit2 = makeSalesReq(orderId, designId, { notes: 'Version 2 revised' });
    const submitRes2 = createMockResponse();
    await submitDesign(submit2, submitRes2);

    expect(submitRes2.statusCode).toBe(201);
    expect(submitRes2.body.data.version).toBe(2);
    expect(submitRes2.body.data.approvalStatus).toBe('PENDING');
  });

  it('allows customer to approve a submitted design', async () => {
    const orderId = await createTestOrder();

    // Submit first
    const submitReq = makeSalesReq(orderId, designId, { notes: 'Ready for approval' });
    const submitRes = createMockResponse();
    await submitDesign(submitReq, submitRes);
    expect(submitRes.statusCode).toBe(201);

    // Approve
    const req = makeCustomerReq(orderId, designId, { notes: 'Perfect, proceed' });
    const res = createMockResponse();
    await approveDesign(req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.approvalStatus).toBe('APPROVED');

    const order = await Order.findById(orderId);
    expect(order.designApproval).toBe('APPROVED');

    const audit = await DesignApprovalAuditLog.findOne({ orderId, designId, action: 'APPROVE' });
    expect(audit).not.toBeNull();

    const notif = await Notification.findOne({ type: 'DESIGN_APPROVED' });
    expect(notif).not.toBeNull();
  });

  it('prevents double approval of an already-approved design', async () => {
    const orderId = await createTestOrder();

    // Submit
    await submitDesign(makeSalesReq(orderId, designId, {}), createMockResponse());

    // Approve once
    const approveRes1 = createMockResponse();
    await approveDesign(makeCustomerReq(orderId, designId, {}), approveRes1);
    expect(approveRes1.body.success).toBe(true);

    // Try to approve again
    const approveRes2 = createMockResponse();
    await approveDesign(makeCustomerReq(orderId, designId, {}), approveRes2);
    expect(approveRes2.statusCode).toBe(400);
    expect(approveRes2.body.error).toContain('current status is APPROVED');
  });

  it('allows customer to reject a submitted design', async () => {
    const orderId = await createTestOrder();

    // Submit
    const submitRes = createMockResponse();
    await submitDesign(makeSalesReq(orderId, designId, {}), submitRes);
    expect(submitRes.statusCode).toBe(201);

    // Reject
    const req = makeCustomerReq(orderId, designId, { rejectionReason: 'Design does not match brief' });
    const res = createMockResponse();
    await rejectDesign(req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.approvalStatus).toBe('REJECTED');
    expect(res.body.data.rejectionReason).toBe('Design does not match brief');

    const order = await Order.findById(orderId);
    expect(order.designApproval).toBe('REJECTED');

    const audit = await DesignApprovalAuditLog.findOne({ orderId, designId, action: 'REJECT' });
    expect(audit).not.toBeNull();

    const notif = await Notification.findOne({ type: 'DESIGN_REJECTED' });
    expect(notif).not.toBeNull();
  });

  it('rejects missing rejection reason', async () => {
    const orderId = await createTestOrder();

    // Submit
    await submitDesign(makeSalesReq(orderId, designId, {}), createMockResponse());

    // Reject with no reason
    const req = makeCustomerReq(orderId, designId, { rejectionReason: '' });
    const res = createMockResponse();
    await rejectDesign(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('required');
  });

  it('prevents sales staff from approving (RBAC)', async () => {
    const orderId = await createTestOrder();

    // Submit
    await submitDesign(makeSalesReq(orderId, designId, {}), createMockResponse());

    // Sales staff tries to approve — should fail
    const req = makeSalesReq(orderId, designId, { notes: 'Self-approving' });
    const res = createMockResponse();
    await approveDesign(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('Unauthorized');
  });
});
