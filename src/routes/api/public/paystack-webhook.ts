import {createFileRoute} from '@tanstack/react-router';
export const Route=createFileRoute('/api/public/paystack-webhook')({server:{handlers:{POST:async({request})=>{
 const secret=process.env['PAYSTARK_SECRET_KEY'];if(!secret)return new Response('Unavailable',{status:503});
 if(Number(request.headers.get('content-length')??0)>262144)return new Response('Too large',{status:413});
 const body=await request.text();if(body.length>262144)return new Response('Too large',{status:413});
 const {validSignature,settleVerified}=await import('@/lib/paystack.server');if(!await validSignature(body,request.headers.get('x-paystack-signature')??'',secret))return new Response('Invalid signature',{status:401});
 try{const event=JSON.parse(body);if(event.event==='charge.success'&&typeof event.data?.reference==='string'){await settleVerified(event.data.reference,secret,process.env['PAYSTARK_BASE_URL']??'https://api.paystack.co');}return new Response('OK');}catch{return new Response('Verification failed',{status:503});}
}}});
