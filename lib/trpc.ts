import {initTRPC} from "@trpc/server"
import * as trpcExpress from '@trpc/server/adapters/express';
import { ZodError } from "zod";

export const createContext = ({
    req,
    res,
  }: trpcExpress.CreateExpressContextOptions) => ({
    req, res
  }); 

export type Context = Awaited<ReturnType<typeof createContext>>;
const t = initTRPC.context<Context>().create({
  errorFormatter(opts) {
    const { shape, error } = opts;
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.code === 'BAD_REQUEST' && error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
