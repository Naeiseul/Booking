const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Cache-Control": "no-store"
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function reply(status, body) { return new Response(JSON.stringify(body), {status, headers:{...cors,"Content-Type":"application/json"}}); }
export async function handle(request, env = Deno.env, fetcher = fetch) {
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
  if(request.method!=="POST") return reply(405,{error:"Use POST."});
  try {
    const length=Number(request.headers.get("content-length")||0);
    if(length>6291456) return reply(413,{error:"Choose a photo smaller than 5 MB."});
    const json=request.headers.get("content-type")?.includes("application/json");
    const body=json?await request.json():await request.formData();
    const get=name=>json?body[name]:body.get(name);
    const slug=get("slug"),key=get("key"),uploadId=get("upload_id");
    if(typeof slug!=="string"||typeof key!=="string"||!uuid.test(uploadId||"")) return reply(400,{error:"Check the upload details."});
    const base=env.get("SUPABASE_URL"),secret=env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!base||!secret) return reply(503,{error:"Photo upload is temporarily unavailable."});
    const headers={"apikey":secret,"Authorization":"Bearer "+secret};
    const auth=await fetcher(base+"/rest/v1/rpc/get_admin_photo_context",{
      method:"POST",headers:{...headers,"Content-Type":"application/json"},
      body:JSON.stringify({p_slug:slug,p_key:key})
    });
    if(!auth.ok) return reply(403,{error:"Reopen your admin link and try again."});
    const business=await auth.json();
    if(typeof business!=="string"||!uuid.test(business)) return reply(403,{error:"Reopen your admin link and try again."});
    let bytes;
    if(json) {
      const source=get("source_path");
      if(typeof source!=="string"||!/^assets\/service-photos\/[a-z0-9][a-z0-9-]*\.(png|jpg|jpeg|webp)$/.test(source)) return reply(400,{error:"Invalid photo source."});
      const response=await fetcher("https://raw.githubusercontent.com/Naeiseul/Booking/main/"+source);
      if(!response.ok) return reply(400,{error:"Photo source could not be loaded."});
      if(Number(response.headers.get("content-length")||0)>5242880) return reply(413,{error:"Choose a photo smaller than 5 MB."});
      bytes=new Uint8Array(await response.arrayBuffer());
    } else {
      const file=get("file");
      if(!file||typeof file.arrayBuffer!=="function") return reply(400,{error:"Choose a photo."});
      if(file.size>5242880) return reply(413,{error:"Choose a photo smaller than 5 MB."});
      bytes=new Uint8Array(await file.arrayBuffer());
    }
    if(bytes.length===0||bytes.length>5242880) return reply(413,{error:"Choose a photo smaller than 5 MB."});
    let ext="",mime="";
    if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((value,i)=>bytes[i]===value)) {ext="png";mime="image/png";}
    else if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255) {ext="jpg";mime="image/jpeg";}
    else if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP") {ext="webp";mime="image/webp";}
    else return reply(415,{error:"Choose a JPG, PNG or WebP photo."});
    const path=business+"/"+uploadId.toLowerCase()+"."+ext;
    const upload=await fetcher(base+"/storage/v1/object/service-photos/"+path,{
      method:"POST",headers:{...headers,"Content-Type":mime,"cache-control":"3600","x-upsert":"true"},body:bytes
    });
    if(!upload.ok) return reply(502,{error:"Photo upload failed. Please try again."});
    return reply(200,{photo_path:path,url:base+"/storage/v1/object/public/service-photos/"+path});
  } catch(_) { return reply(500,{error:"Photo upload failed. Please try again."}); }
}
Deno.serve(request => handle(request));
