import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
export async function invoicePdf(invoice) {
 const document=await PDFDocument.create();const font=await document.embedFont(StandardFonts.Helvetica);
 const bold=await document.embedFont(StandardFonts.HelveticaBold);
 let page=document.addPage([595.28,841.89]),y=790;
 const plain=value=>Array.from(String(value||'')).map(char=>{if(char==='\n')return char;try{font.encodeText(char);return char;}catch{return '?';}}).join('');
 function line(value,size=11,strong=false){
  const selected=strong?bold:font;
  const words=plain(value).split(/\s+/);let text='';
  for(const word of words){const next=text?text+' '+word:word;
   if(selected.widthOfTextAtSize(next,size)>490&&text){draw(text,size,selected);text=word;}else text=next;}
  if(text)draw(text,size,selected);
 }
 function draw(text,size,selected){
  if(y<65){page=document.addPage([595.28,841.89]);y=790;}
  // Bound unusually long unbroken fields without exceeding the page.
  while(selected.widthOfTextAtSize(text,size)>490){let n=text.length;while(n>1&&selected.widthOfTextAtSize(text.slice(0,n),size)>490)n--;page.drawText(text.slice(0,n),{x:52,y,size,font:selected,color:rgb(.08,.08,.08)});y-=size+7;text=text.slice(n);if(y<65){page=document.addPage([595.28,841.89]);y=790;}}
  if(text){page.drawText(text,{x:52,y,size,font:selected,color:rgb(.08,.08,.08)});y-=size+7;}
 }
 const money=cents=>'ZAR '+(Number(cents)/100).toFixed(2);
 line(invoice.seller.name,20,true);line('INVOICE '+invoice.number,15,true);
 line('Status: '+invoice.status.toUpperCase());line('Issued: '+invoice.created_at.slice(0,10));
 if(invoice.due_date)line('Due: '+invoice.due_date);if(invoice.seller.email)line(invoice.seller.email);if(invoice.seller.phone)line(invoice.seller.phone);
 y-=14;line('Bill to',12,true);line(invoice.customer.name);line(invoice.customer.email);if(invoice.customer.address)line(invoice.customer.address);
 y-=14;for(const item of invoice.items){line(item.description,11,true);line(item.quantity+' x '+money(item.unit_amount)+' = '+money(item.quantity*item.unit_amount));y-=7;}
 line('TOTAL '+money(invoice.total_amount),16,true);
 if(invoice.paid_at)line('Payment recorded: '+new Date(invoice.paid_at).toISOString().slice(0,10));
 if(invoice.notes){y-=16;line('Notes',11,true);line(invoice.notes);}
 y-=18;line('This invoice does not confirm a reserved appointment or class place.',9);
 document.setTitle(invoice.number);document.setAuthor(plain(invoice.seller.name));
 return await document.save();
}
