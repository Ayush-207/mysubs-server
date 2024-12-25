import nodemailer from 'nodemailer'
import handlebars from 'handlebars'
import fs from 'fs'
import path from 'path'

interface MailProps{
    to: string,
    subject: string,
    payload:{},
    template: string
}

export const sendingMail = async({to, subject, payload, template}: MailProps) =>{
    try {
    const source = fs.readFileSync(path.join(__dirname, template), "utf8");
    const compiledTemplate = handlebars.compile(source);   
    const Transporter = nodemailer.createTransport({
        service: "Gmail",
        auth: {
          user: process.env.email,
          pass: process.env.emailpassword,
        },
      });
  
      let mailOptions = ({
        from: process.env.email,
        to,
        subject,
        html: compiledTemplate(payload)
    })
      return await Transporter.sendMail(mailOptions) 
    } catch (error) {
      console.log(error)
    }
  }
  