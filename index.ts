import express, { Response, Request } from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import { router } from "./lib/trpc.js";
import { authRouter } from "./routes/auth";
import * as trpcExpress from "@trpc/server/adapters/express";
import { createContext } from "./lib/trpc.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import "./scraping/scraping.js";
import Subreddit from "./models/subreddit.js";
import User from "./models/user.js";
import Token from "./models/token.js";
import * as crypto from "crypto";
import bcrypt from "bcrypt";
import { sendingMail } from "./nodemailer/mailing.js";
import { asyncHandler } from "./lib/asyncHandler.js";
import jwt from "jsonwebtoken";

dotenv.config();

const appRouter = router({
  auth: authRouter,
});

const app = express();
const port = process.env.PORT || 3001;
const databaseURL = process.env.DATABASE_URL || "";

app.use(
  cors({
    origin: [process.env.ORIGIN || ""],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

app.get("/verify-email/:id/:token", async (req: Request, res: Response) => {
  try {
    const token = req.params.token;
    const id = req.params.id;
    const user = await User.findById(id);
    const isValidToken = (user?.uniqueString ?? "akjfkdjdfd") == token;
    if (!user) {
      res.status(401).send({
        msg: "We were unable to find a user for this verification. Please SignUp!",
      });
      return;
    } else if (!isValidToken) {
      res.status(401).send({
        msg: "Incorrect token for this user. Please try again.",
      });
      return;
    } else {
      if (user.verified) {
        res.status(200).send("User has been already verified. Please Login");
        return;
      } else {
        const updated = await User.findOneAndUpdate(
          { id: user.id },
          { verified: true }
        );

        if (!updated) {
          res.status(500).send({ msg: "Failed to verify. Try again." });
          return;
        } else {
          res.status(200).send("Your account has been successfully verified");
          return;
        }
      }
    }
  } catch (error) {
    console.log(error);
  }
});

app.post(
  "/reset-password",
  asyncHandler(async (req: Request, res: Response) => {
    const { email, token, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("User does not exist");
    }
    const userToken = await Token.findOne({ userId: user._id });
    if (!userToken) {
      throw new Error("No token exists, go to forget password first");
    }
    const compareToken = await bcrypt.compare(token, userToken.token);
    if (!compareToken) {
      throw new Error("Token is not valid");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await user.updateOne({ password: hashedPassword, verified: true });
    res.status(200).send("Password updated successfully.");
  })
);

app.post(
  "/forgot-password",
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("User does not exist");
    }

    let token = await Token.findOne({ userId: user._id });
    if (token) {
      await token.deleteOne();
    }
    console.log(token);
    let resetToken = crypto.randomBytes(32).toString("hex");
    const hash = await bcrypt.hash(resetToken, 10);
    await new Token({
      userId: user._id,
      token: hash,
      createdAt: Date.now(),
    }).save();

    sendingMail({
      to: `${email}`,
      subject: "Reset password link",
      payload: {
        name: user.username,
        link: `${process.env.ORIGIN_URL}/reset-password?token=${resetToken}&email=${user.email}`,
      },
      template: "./template/requestResetPassword.handlebars",
    });
    res.end();
  })
);

app.get("/subreddits", async (req: Request, res: Response) => {
  try {
    const page =
      typeof req.query.page == "string" ? parseInt(req.query.page) : 1;
    const limit =
      typeof req.query.limit == "string" ? parseInt(req.query.limit) : 25;

    const skip = (page - 1) * limit;
    const token = req.headers.authorization;
    const access_token = token?.replace("Bearer ", "");
    if (token && access_token && access_token?.length > 0) {
      try {
        const payload = jwt.verify(
          access_token,
          process.env.JWT_KEY || "randomsecret"
        );
        if (payload) {
          const subreddits = await Subreddit.find()
            .sort({ subscribers: -1 })
            .exec();

          res.json({
            success: true,
            data: subreddits,
          });
        } else {
          const subreddits = await Subreddit.find()
            .sort({ subscribers: -1 })
            .skip(skip)
            .limit(limit)
            .exec();

          const total = await Subreddit.countDocuments();

          res.json({
            success: true,
            data: subreddits,
          });
        }
      } catch {
        const subreddits = await Subreddit.find()
          .sort({ subscribers: -1 })
          .skip(skip)
          .limit(limit)
          .exec();

        const total = await Subreddit.countDocuments();

        res.json({
          success: true,
          data: subreddits,
        });
      }
    }
  } catch (error) {
    console.error(`error: ${error}`);
    if (error instanceof Error)
      res.status(500).json({
        success: false,
        message: "Server Error",
        error: error.message,
      });
  }
});

app.use(errorHandler);
app.listen(port, () => {
  console.log(`Server is running on PORT - ${port}`);
});

mongoose
  .connect(databaseURL)
  .then(() => {
    console.log("DB connected successfully");
  })
  .catch((err: Error) => {
    console.log(err.message);
  });

export type AppRouter = typeof appRouter;
