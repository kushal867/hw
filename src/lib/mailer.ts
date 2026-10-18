import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

export const mailEnabled = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);

let transport: Transporter | undefined;
export async function sendMail(to: string, subject: string, text: string) {
  if (!mailEnabled()) { console.warn(`[mail disabled] to=${to} subject="${subject}"`); return; }
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
}
