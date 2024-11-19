import express, { Response, Request } from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import mongoose from 'mongoose' 
import {router} from './lib/trpc.js'
import {authRouter} from './routes/auth'
import * as trpcExpress from '@trpc/server/adapters/express';
import { createContext } from './lib/trpc.js'
import {errorHandler} from './middlewares/errorHandler.js'
import './scraping/scraping.js'
import Subreddit from './models/subreddit.js'

dotenv.config()

const appRouter = router({
    auth: authRouter
})

const app = express()
const port = process.env.PORT || 3001
const databaseURL = process.env.DATABASE_URL || ""

app.use(
    cors({
        origin: [process.env.ORIGIN || ""],
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        credentials: true
    })
)

app.use(cookieParser())
app.use(express.json())

app.use("/trpc", trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext
}))

app.get('/subreddits', async (req: Request, res: Response) => {
    try {
      const page = typeof req.query.page == 'string' ? parseInt(req.query.page) : 1 ;
      const limit = typeof req.query.limit == 'string' ? parseInt(req.query.limit) : 10;
  
      const skip = (page - 1) * limit;
  
      const subreddits = await Subreddit.find()
        .sort({ subscribers: -1 }).skip(skip).limit(limit).exec()
  
      const total = await Subreddit.countDocuments();
  
      res.json({
        success: true,
        data: subreddits,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error(error);
      if(error instanceof Error)
      res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
  });

app.use(errorHandler)
app.listen(port, ()=>{
    console.log(`Server is running on PORT - ${port}`)
})

mongoose.connect(databaseURL).then(()=>{
    console.log("DB connected successfully")
}). catch((err: Error) => {
    console.log(err.message)
})

export type AppRouter = typeof appRouter