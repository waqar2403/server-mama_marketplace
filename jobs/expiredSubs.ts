
import cron from "node-cron";
import nodemailer from "nodemailer";
import { redis } from "../utils/redis";
import { PayrexxService } from '../utils/payrexxService';
import { v2 as cloudinary } from "cloudinary";
import productModel from "../Models/product.model";
import userModel from "../Models/user.model";
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: process.env.SMTP_SERVICE,
  auth: {
    user: process.env.SMTP_MAIL, 
    pass: process.env.SMTP_PASSWORD,
  },
});

const deactivateExpiredAds = async () => {
    try {
      const today = new Date();
      const expiredSubs = await userModel.find({
        paymentExpiryDate: { $lte: today }
      });
  
      for (const i of expiredSubs) {
        const ads = await productModel.find({ postedBy: i._id });
        for (const ad of ads) {
          ad.status = "InActive";
          await ad.save();
        }
      }
}
    catch (error) {
      console.error("Error processing expired ads:", error);
    }
};
  
cron.schedule("0 0 * * *", deactivateExpiredAds);