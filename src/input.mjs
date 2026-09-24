export const MAX_BODY=8*1024*1024;
export function validateInput(raw) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw)) throw Error('Request must be an object');
  if(Object.keys(raw).some(k=>!['description','environment','logs','mode','image','product'].includes(k))) throw Error('Unknown request field');
  const input={description:raw.description,environment:raw.environment===undefined?'':raw.environment,logs:raw.logs===undefined?'':raw.logs,mode:raw.mode,image:raw.image??null,product:raw.product??'auto'};
  for(const [key,min,max] of [['description',20,20000],['environment',0,1000],['logs',0,80000]]) if(typeof input[key]!=='string'||input[key].trim().length<min||input[key].length>max) throw Error(`${key} must contain ${min}–${max} characters`);
  if(!['demo','ai'].includes(input.mode)) throw Error('mode must be demo or ai');
  if(!['auto','vbcs','oic'].includes(input.product)) throw Error('product must be auto, vbcs or oic');
  if(input.image!==null) {
    const im=input.image;
    if(typeof im!=='object'||Array.isArray(im)||Object.keys(im).sort().join(',')!=='dataUrl,id,mimeType,name'||im.id!=='screenshot-1'||typeof im.name!=='string'||!im.name.trim()||im.name.length>255||typeof im.dataUrl!=='string') throw Error('Supply one image object with id screenshot-1, name, mimeType and dataUrl');
    if(!['image/png','image/jpeg','image/webp'].includes(im.mimeType)) throw Error('Only PNG, JPEG and WebP are supported');
    const prefix=`data:${im.mimeType};base64,`;
    if(!im.dataUrl.startsWith(prefix)) throw Error('Image data URL MIME does not match mimeType');
    const b64=im.dataUrl.slice(prefix.length);
    if(!b64||b64.length%4||!(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/).test(b64)) throw Error('Invalid image base64');
    const buf=Buffer.from(b64,'base64');
    if(buf.toString('base64')!==b64||buf.length>4*1024*1024) throw Error('Image must be valid base64 and at most 4 MB');
    const png=buf.length>=33&&buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&buf.toString('ascii',12,16)==='IHDR';
    const jpeg=buf.length>=4&&buf[0]===255&&buf[1]===216&&buf[2]===255&&buf.at(-2)===255&&buf.at(-1)===217;
    const webp=buf.length>=20&&buf.toString('ascii',0,4)==='RIFF'&&buf.toString('ascii',8,12)==='WEBP'&&buf.readUInt32LE(4)+8===buf.length;
    if(!({'image/png':png,'image/jpeg':jpeg,'image/webp':webp}[im.mimeType])) throw Error('Image signature does not match MIME type or image is truncated');
  }
  return input;
}
