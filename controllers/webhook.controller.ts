import { Request, Response, NextFunction } from "express";
import userModel, { IUser } from "../Models/user.model";
import ErrorHandler from "../utils/ErroreHandler";
import { CatchAsyncErrore } from "../middleware/catchAsyncErrors";
import { redis } from "../utils/redis";
import { PayrexxService } from '../utils/payrexxService';
import { v2 as cloudinary } from "cloudinary";
import productModel from "../Models/product.model";
import dotenv from "dotenv";

dotenv.config();

const instance = process.env.PAYREXX_INSTANCE;
const secret = process.env.PAYREXX_API_KEY;

if (!instance || !secret) {
  throw new Error("PAYREXX_INSTANCE and PAYREXX_SECRET must be defined in environment variables");
}

const payrexx = new PayrexxService(instance, secret);



export const webhookController = CatchAsyncErrore(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    const email = 
    data?.transaction?.contact?.email || 
    data?.subscription?.contact?.email;
  const status = 
    data?.transaction?.status || 
    data?.subscription?.status;

  if (!email) {
    console.error("Email not found in webhook data");
    return res.status(400).json({ success: false, message: "Email not found in webhook data" });
  }
    console.log('email',email);
    console.log('status',status);
    console.log("aik hogyaaa");
    
    if (!email) {
      return res.status(400).json({ success: false, message: "Email not found in webhook data" });
    }

    if ( status === 'declined' || status === 'failed' ) {
      const user=await userModel.findOne({email:email}) as IUser
      const userId=user._id as string
      const subscriptionId = parseInt(user.subscriptionId as string, 10);
      await payrexx.DeleteSubscription(subscriptionId);
      await redis.del(userId);
      
      await userModel.findOneAndDelete({email:email});
      return res.status(200).json({ success: true, message: "User deleted successfully" }); 
    }
    if(status === 'in_notice' || status === 'cancelled' || status === 'waiting'){
      const user=await userModel.findOne({email:email}) as IUser
      user.paymentStatus = status;
      await user.save();
      return res.status(200).json({ success: true, message: "Payment status updated successfully" });
    }
    if( status ==='active' || status === 'confirmed'){
      const user=await userModel.findOne({email:email}) as IUser
      user.paymentStatus = status;
      user.paymentDate = new Date();
      user.paymentExpiryDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1));
      await user.save();
      return res.status(200).json({ success: true, message: "Payment status updated successfully" });
    }
    return res.status(200).json({ success: true, message: "Payment status updated successfully" });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return res.status(200).json({ 
      success: true, 
      message: " webhook" 
    });
  }
});