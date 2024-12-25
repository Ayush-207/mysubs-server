import mongoose from "mongoose";
import { number } from "zod";

const subredditSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  niche: {
    type: String,
  },
  subscribers: {
    type: Number,
    default: "0",
  },
  title: {
    type: String,
  },
  verification: {
    type: Number,
  },
  selling: {
    type: Number,
  },
  watermark: {
    type: Number,
  },
  icon: {
    type: String,
  },
});

const Subreddit = mongoose.model("Subreddit", subredditSchema);
export default Subreddit;
