import nodemailer from 'nodemailer';

const isProd = process.env.NODE_ENV === 'production';

export const transporter = nodemailer.createTransport({
  host: isProd ? 'postfix' : 'localhost',
  port: 25,
  secure: false,
  tls: { rejectUnauthorized: isProd },
});

export const MAIL_FROM = process.env.MAIL_FROM || 'noreply@kintales.net';
