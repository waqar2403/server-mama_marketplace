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
    const email = data.transaction.contact.email || data.subscription.contact.email;
    const status = data.transaction.status || data.subscription.status;
    
    if (!email) {
      return res.status(400).json({ success: false, message: "Email not found in webhook data" });
    }

    if (status === 'in_notice' || status === 'cancelled' || status === 'declined' || status === 'failed' ) {
      const user=await userModel.findOne({email:email}) as IUser
      const userId=user._id as string
      const subscriptionId = parseInt(user.subscriptionId as string, 10);
      const response = await payrexx.DeleteSubscription(subscriptionId);
      const userPosts = await productModel.find({ postedBy: userId });
      for (const post of userPosts) {
          // Find the product to retrieve the images
          const product = await productModel.findById(post._id);
    
          if (product && product.images && product.images.length > 0) {
            // Delete images from Cloudinary
            const deletionPromises = product.images.map((image) =>
              cloudinary.uploader.destroy(image.public_id)
            );
            await Promise.all(deletionPromises);
        
          }
    
          // Delete the product from the database
          await productModel.findByIdAndDelete(post._id);
          console.log(`Product ${post._id} deleted successfully from the database`);
        }
      await redis.del(userId);
      
      await userModel.findOneAndDelete({email:email});
     
    }
  } catch (err) {
    console.error("Webhook processing error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error processing webhook" 
    });
  }
});