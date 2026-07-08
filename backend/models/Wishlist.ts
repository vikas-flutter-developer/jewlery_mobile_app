import mongoose from "mongoose";

const wishlistSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true, index: true },
    items: [
      {
        designCode: { type: String, required: true },
        name: { type: String, required: true },
        category: String,
        addedAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

const Wishlist = (mongoose.models.Wishlist || mongoose.model("Wishlist", wishlistSchema)) as mongoose.Model<any>;
export default Wishlist;
