import { router, publicProcedure } from "../lib/trpc";
import { z } from "zod";
import * as bcrypt from "bcrypt";
import User from "../models/user";
import { sign } from "jsonwebtoken";
import { TRPCError } from "@trpc/server";
import { sendingMail } from "../nodemailer/mailing";

const maxAge = 3 * 24 * 60 * 60 * 1000;

const createToken = (email: string, userId: string) => {
  return sign({ email, userId }, process.env.JWT_KEY || "randomSecret", {
    expiresIn: maxAge,
  });
};

const createVerificationToken = (email: string) => {
  return sign({ email }, process.env.JWT_KEY || "randomSecret", {
    expiresIn: maxAge,
  });
};

export const authRouter = router({
  register: publicProcedure
    .input(
      z.object({
        firstname: z.string(),
        lastname: z.string(),
        username: z.string(),
        email: z
          .string()
          .min(1, "Email is required")
          .email("Invalid email address"),
        password: z.string().min(6, "Minimum password length: 6"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { firstname, lastname, username, email, password } = input;

      try {
        const existingUser = await User.findOne({
          $or: [{ email }, { username }],
        });

        if (existingUser) {
          const errors = [];
          if (email === existingUser.email) {
            errors.push("Email already exists");
          }
          if (username === existingUser.username) {
            errors.push("Username already exists");
          }

          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              errors.length > 2
                ? errors[0]
                : "Email and Username already exists",
          });
        }

        const saltRounds = 10;
        const salt = await bcrypt.genSalt(saltRounds);
        const hashedPassword = await bcrypt.hash(password, salt);
        const token = createVerificationToken(email);
        const user = await User.create({
          firstname,
          lastname,
          username,
          email,
          password: hashedPassword,
        });

        if (token && user) {
          sendingMail({
            to: `${email}`,
            subject: "Account Verification Link",
            payload: {
              name: user.username,
              link: `${process.env.ORIGIN}/verify-email/${user.id}/${token}`,
            },
            template: "./template/verifyProfile.handlebars",
          });
        } else {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Something went wrong",
          });
        }
        return user;
      } catch (error: any) {
        if (!(error instanceof TRPCError)) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Something went wrong",
          });
        }
        throw error;
      }
    }),
  login: publicProcedure
    .input(
      z.object({
        email: z
          .string()
          .min(1, "Email is required")
          .email("Invalid email address"),
        password: z.string().min(6, "Minimum password length: 6"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { email, password } = input;
      try {
        const user = await User.findOne({
          email: email,
        });
        if (user) {
          if (!user.verified) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "User is not verified.",
            });
          }
          const comparePassword = await bcrypt.compare(password, user.password);
          if (comparePassword) {
            const token = createToken(email, user.id);
            ctx.res.cookie("session-token", token, {
              httpOnly: true,
              maxAge: 3 * 24 * 60 * 60 * 1000,
              secure: true,
            });
            return { user, token };
          } else {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Email or password invalid.",
            });
          }
        } else {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "User not found. Try signing up.",
          });
        }
      } catch (error: any) {
        if (!(error instanceof TRPCError)) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Something went wrong",
          });
        }
        throw error;
      }
    }),
});

// User.findOne({
//   email: email
// }).then(async (user) => {
//   if(user){
//       if(!user.verified){
//         throw new TRPCError({
//           code: 'BAD_REQUEST',
//           message: 'User is not verified.'
//       })
//       return;
//       }
//       const comparePassword = await bcrypt.compare(password, user.password);
//       if(comparePassword){
//           const token = createToken(email, user.id)
//           ctx.res.cookie('session-token', token, {httpOnly: true, maxAge: 3*24*60*60*1000, secure: true})
//           return user;
//       } else {
//           throw new TRPCError({
//               code: 'BAD_REQUEST',
//               message: 'Email or password invalid.'
//           })
//       }
//   } else {
//       throw new TRPCError({
//           code: 'BAD_REQUEST',
//           message: 'User not found. Try signing in.'
//       })
//   }
// }).catch(err => {
// throw err
// })
