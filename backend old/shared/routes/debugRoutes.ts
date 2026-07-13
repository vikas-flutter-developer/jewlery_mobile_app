import express from "express";
import User from "../../models/User.js";
import { ManufacturerUser } from "../../manufacturer/models/index.js";
import { User as RetailerUser } from "../../retailer/models/index.js";

const router = express.Router();

const findUserHandler = async (req: any, res: any) => {
  const email = (req.method === 'GET' ? (req.query.email || '') : (req.body.email || '')) .toString();
  if (!email) return res.status(400).json({ error: 'email query required' });
  try {
    const results: any = {};
    results.default = await User.findOne({ email }).lean().catch(() => null);
    results.manufacturer = await ManufacturerUser.findOne({ email }).lean().catch(() => null);
    results.retailer = await RetailerUser.findOne({ email }).lean().catch(() => null);
    return res.json({ success: true, data: results });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

router.get('/find-user', findUserHandler);
router.post('/find-user', findUserHandler);

export default router;
