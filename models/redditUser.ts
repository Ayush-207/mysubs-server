import mongoose from "mongoose";
import { boolean } from "zod";

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Email is required."],
    unique: true,
  },
  password: {
    type: String,
    required: [true, "Password is required"],
  },
  firstname: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  lastname: {
    type: String,
    required: true,
  },
  uniqueString: {
    type: String,
  },
  verified: {
    type: Boolean,
    required: true,
    default: false,
  },
});

const User = mongoose.model("Users", userSchema);

export default User;
