import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  host: process.env.NODE_ENV === 'production' ? 'postfix' : 'localhost',
  port: 25,
  secure: false,
  tls: { rejectUnauthorized: false },
});

export const MAIL_FROM = process.env.MAIL_FROM || 'noreply@kintales.com';
