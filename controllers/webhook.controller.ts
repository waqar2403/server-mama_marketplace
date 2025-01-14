import { Request,Response,NextFunction } from "express";
import userModel, { IUser } from "../Models/user.model";
import ErroreHandler from "../utils/ErroreHandler";
import { CatchAsyncErrore } from "../middleware/catchAsyncErrors";
import { redis } from "../utils/redis";
import { PayrexxService } from '../utils/payrexxService';
import productModel from "../Models/product.model";
import dotenv from "dotenv"
dotenv.config()
const instance = process.env.PAYREXX_INSTANCE;
const secret = process.env.PAYREXX_API_KEY;
if (!instance || !secret) {
  throw new Error("PAYREXX_INSTANCE and PAYREXX_SECRET must be defined in environment variables");
}
const payrexx = new PayrexxService(instance, secret);
export const webhookController = CatchAsyncErrore(async (req:Request,res:Response,next:NextFunction)=>{
    try{
        const data = req.body;
    const email = req?.body?.subscription?.contact?.email;
    const status = req?.body?.subscription?.status;
    const renew = req?.body?.transaction?.status;
    
 if((status !== undefined && status !== null) || (renew !== undefined && renew !== null)){   
    if((status !== "active"  || renew !== "confirmed" ) && ((status !== "waiting"  || renew !== "waiting" ))){
    const user=await userModel.findOne({email:email}) as IUser
        const userId=user._id as string
        const subscriptionId = parseInt(user.subscriptionId as string, 10);
        const response = await payrexx.DeleteSubscription(subscriptionId);
        const userPosts = await productModel.find({ postedBy: userId });
        
        for (const post of userPosts) {
          await productModel.findByIdAndDelete(post._id);
        }
        await redis.del(userId);
        
        await userModel.findOneAndDelete({email:email});
       
    }
}
    res.status(200).json({success:true})}
    catch(err){
        res.status(400).json({success:false})
    }
})