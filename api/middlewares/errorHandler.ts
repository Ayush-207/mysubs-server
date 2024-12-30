import { ErrorRequestHandler } from 'express'
import {TRPCError} from '@trpc/server'

export const errorHandler: ErrorRequestHandler = (
    err,
    req,
    res,  
    next) => {
    
    if(err instanceof Error){
        console.log(err)
        res.status(500).json({error: err.message})
    }
    next()
}