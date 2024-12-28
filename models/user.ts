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
});

const User = mongoose.model("Users", userSchema);

export default User;
