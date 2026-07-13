import { Request, Response } from 'express';
import { AuthRequest } from '../../../lib/authUtils.js';
import { SuperAdminSupportTicket } from '../../../superadmin/models/index.js';
import { isDbConnected } from '../../../lib/serverState.js';
import { getAllFallbackTickets, addFallbackTicket } from '../../../lib/fallbackStore.js';

const normalizeTicket = (ticket: any) => ({
  ...ticket,
  subject: ticket.subject || ticket.title || 'Support request',
  content: ticket.content || ticket.description || '',
  customerName: ticket.customerName || ticket.userName || ticket.shopName || 'Unknown',
  email: ticket.email || ticket.userEmail || 'unknown@aurajewel.com',
  replies: Array.isArray(ticket.replies) ? ticket.replies.map((reply: any) => ({
    ...reply,
    message: reply.message || reply.text || '',
    senderRole: reply.senderRole || reply.sender || 'USER',
  })) : []
});

export const getMySupportTickets = async (req: AuthRequest, res: Response) => {
  try {
    const userEmail = req.user?.email;
    const userId = req.user?.id;

    if (isDbConnected()) {
      const tickets = await SuperAdminSupportTicket.find({
        $or: [
          { email: userEmail },
          { customerId: userId }
        ]
      }).sort({ updatedAt: -1 }).lean();
      return res.json({ success: true, data: tickets.map(normalizeTicket) });
    }

    const tickets = await getAllFallbackTickets();
    const filtered = (tickets || []).filter((ticket: any) => {
      if (userEmail && ticket.email === userEmail) return true;
      if (userId && ticket.customerId === userId) return true;
      return false;
    }).sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return res.json({ success: true, data: filtered.map(normalizeTicket) });
  } catch (error) {
    console.error('Failed to load customer support tickets', error);
    return res.status(500).json({ success: false, error: 'Failed to load customer support tickets' });
  }
};

export const createSupportTicket = async (req: AuthRequest, res: Response) => {
  try {
    const {
      shopName,
      customerName,
      category,
      title,
      description,
      subject,
      content,
      email: payloadEmail,
    } = req.body;

    const ticketShopName = shopName || customerName || req.user?.email || 'Unknown Shop';
    const ticketCustomerName = customerName || req.user?.email || 'Unknown User';
    const ticketEmail = payloadEmail || req.user?.email;
    const ticketCustomerId = req.user?.id;
    const ticketSubject = subject || title;
    const ticketContent = content || description;

    if (!ticketShopName || !ticketSubject || !ticketContent || !ticketEmail) {
      return res.status(400).json({ success: false, error: 'Missing required support ticket fields' });
    }

    const payload = {
      _id: `TKT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      shopName: ticketShopName,
      customerName: ticketCustomerName,
      customerId: ticketCustomerId,
      email: ticketEmail,
      subject: ticketSubject,
      content: ticketContent,
      title: ticketSubject,
      description: ticketContent,
      status: 'OPEN',
      category: category || 'OTHER',
      replies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isDbConnected()) {
      const ticket = await SuperAdminSupportTicket.create(payload);
      return res.status(201).json({ success: true, data: normalizeTicket(ticket.toObject()) });
    }

    const ticket = await addFallbackTicket(payload);
    return res.status(201).json({ success: true, data: normalizeTicket(ticket) });
  } catch (error) {
    console.error('Failed to create customer support ticket', error);
    return res.status(500).json({ success: false, error: 'Failed to create customer support ticket' });
  }
};
