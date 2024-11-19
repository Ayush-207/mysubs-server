import {Request, Response, NextFunction} from 'express'
import {mongo} from 'mongoose'
import {TRPCError} from '@trpc/server'

export const errorHandler = (
    err: TRPCError,
    req: Request,
    res: Response,  
    next: NextFunction) => {
    console.log("hellow")
  
    if(err instanceof TRPCError){
        res.status(500).send("TRPC Error")
    }
    next()
}