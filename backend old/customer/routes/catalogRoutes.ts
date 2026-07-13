import express from 'express';
import { 
  getDesigns, 
  createDesign, 
  deleteDesign,
  getWishlists, 
  addToWishlist, 
  removeFromWishlist, 
  updateItemLocation, 
  getLowStockAlerts, 
  getDeadStockReport, 
  getItemAgingReport 
} from '../controllers/catalog/catalogController.js';

const router = express.Router();

router.get('/designs', getDesigns);
router.post('/designs', createDesign);
router.delete('/designs/:id', deleteDesign);
router.get('/wishlist', getWishlists);
router.post('/wishlist', addToWishlist);
router.delete('/wishlist/:id', removeFromWishlist);
router.put('/inventory/:barcode/location', updateItemLocation);
router.get('/alerts/low-stock', getLowStockAlerts);
router.get('/reports/dead-stock', getDeadStockReport);
router.get('/reports/aging', getItemAgingReport);

export default router;


