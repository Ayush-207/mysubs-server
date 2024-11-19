import {router, publicProcedure} from '../lib/trpc'
import {z} from 'zod'
import * as bcrypt from 'bcrypt'
import User from '../models/user'
import {sign} from 'jsonwebtoken'
import {TRPCError} from '@trpc/server'

const maxAge = 3*24*60*60*1000;

const createToken = (email: string, userId: string) => {
    return sign({email, userId}, process.env.JWT_KEY || "randomSecret", {
        expiresIn: maxAge
    })
}   

export const authRouter = router({
    register: publicProcedure
    .input(
      z.object({
        firstname: z.string(),
        lastname: z.string(),
        username: z.string(),
        email: z.string().min(1, 'Email is required').email('Invalid email address'),
        password: z.string().min(6, 'Password is required'),
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
            errors.push('Email already exists');
          }
          if (username === existingUser.username) {
            errors.push('Username already exists');
          }

          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: errors.join(', '),
          });
        }

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
        ctx.res.cookie('session-token', token, { httpOnly: true });
        return user;

      } catch (error: any) {
        if (!(error instanceof TRPCError)) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message || 'Something went wrong',
          });
        }
        throw error;
      }
    }),
    login: publicProcedure.input(
        z.object({
            email: z.string().min(1, "Email is required").email('Invalid email address'),
            password: z.string().min(6, 'Password is required'),
        })).query(({ctx, input}) => {
            const {email, password} = input
            User.findOne({
                email: email
            }).then(async (user) => {
                if(user){
                    const comparePassword = await bcrypt.compare(password, user.password)
                    if(comparePassword){
                        const token = createToken(email, user.id)
                        ctx.res.cookie('session-token', token, {httpOnly: true})
                        return user;
                    } else {
                        throw new TRPCError({
                            code: 'BAD_REQUEST', 
                            message: 'Email or password invalid.'
                        })
                    }
                } else {
                    throw new TRPCError({
                        code: 'BAD_REQUEST', 
                        message: 'User not found. Try signing in.'
                    })
                }
            })
        })
})
