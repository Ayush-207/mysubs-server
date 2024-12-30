import express, { Response, Request } from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
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

const maxAge = 3 * 24 * 60 * 60 * 1000;

const createToken = (email: string, userId: string) => {
  return jwt.sign({ email, userId }, process.env.JWT_KEY || "randomSecret", {
    expiresIn: maxAge,
  });
};

function generateOTP() {
  return crypto.randomInt(100000, 999999);
}

app.post(
  "/sign-in",
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const user = await User.findOne({
      email: email,
    });
    if (user) {
      const comparePassword = await bcrypt.compare(password, user.password);
      if (comparePassword) {
        const token = createToken(email, user.id);
        res.status(200).send({ user, token });
      } else {
        res.status(400).send("Email or password invalid.");
        return;
      }
    } else {
      res.status(400).send("User not found. Try signing up.");
      return;
    }
  })
);

app.post(
  "/sign-up",
  asyncHandler(async (req: Request, res: Response) => {
    const { firstname, lastname, username, email, password } = req.body;
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      let errors: string[] = [];
      if (email === existingUser.email) {
        errors.push("Email already exists");
      }
      if (username === existingUser.username) {
        errors.push("Username already exists");
      }

      res
        .status(400)
        .send(
          errors.length < 2 ? errors[0] : "Email and Username already exists"
        );
    } else {
      const saltRounds = 10;
      const salt = await bcrypt.genSalt(saltRounds);
      const hashedPassword = await bcrypt.hash(password, salt);
      const user = await User.create({
        firstname,
        lastname,
        username,
        email,
        password: hashedPassword,
      });
      const token = createToken(email, user.id);
      res.status(200).send({ user, token });
    }
  })
);

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
    await user.updateOne({ password: hashedPassword });
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

app.post(
  "/auth/register/reddit",
  asyncHandler(async (req: Request, res: Response) => {})
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
    console.log(token);
    console.log(access_token);
    if (token && access_token && access_token?.length > 0) {
      try {
        const payload = jwt.verify(
          access_token,
          process.env.JWT_KEY || "randomsecret"
        );
        console.log(payload);
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
    } else {
      res.status(400).json({
        success: false,
        message: "BAD_REQUEST",
        error: "No authorization token",
      });
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
