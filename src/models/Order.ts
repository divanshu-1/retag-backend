import mongoose, { Schema, Document } from 'mongoose';

export interface IOrder extends Document {
  user: mongoose.Types.ObjectId;
  address: {
    name: string;
    phone: string;
    pincode: string;
    house: string;
    area: string;
  };
  cart: Array<{
    productId: string;
    name: string;
    price: string;
    quantity: number;
    image?: string;
  }>;
  amount: number;
  status: 'created' | 'paid' | 'failed';
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  estimatedDeliveryDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  address: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    pincode: { type: String, required: true },
    house: { type: String, required: true },
    area: { type: String, required: true },
  },
  cart: [
    {
      productId: { type: String, required: true },
      name: { type: String, required: true },
      price: { type: String, required: true },
      quantity: { type: Number, required: true },
      image: { type: String },
    }
  ],
  amount: { type: Number, required: true },
  status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' },
  razorpayOrderId: { type: String, required: true },
  razorpayPaymentId: { type: String },
  estimatedDeliveryDate: { type: Date },
}, { timestamps: true });

export default mongoose.model<IOrder>('Order', OrderSchema); 